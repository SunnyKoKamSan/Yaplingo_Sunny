import base64
import json
import logging
import re
import urllib.parse
import urllib.request

import httpx

from gtts.lang import _fallback_deprecated_lang, tts_langs
from gtts.tokenizer import Tokenizer, pre_processors, tokenizer_cases
from gtts.utils import _clean_tokens, _minimize, _translate_url

__all__ = ["gTTS", "gTTS", "agTTS", "gTTSError"]

# Logger
log = logging.getLogger(__name__)
log.addHandler(logging.NullHandler())


class Speed:
    """Read Speed

    The Google TTS Translate API supports two speeds:
        Slow: True
        Normal: None
    """

    SLOW = True
    NORMAL = None


class _gTTS:
    GOOGLE_TTS_MAX_CHARS = 100  # Max characters the Google TTS API takes at a time
    GOOGLE_TTS_HEADERS = {
        "Referer": "http://translate.google.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/47.0.2526.106 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    }
    GOOGLE_TTS_RPC = "jQ1olc"

    def __init__(
        self,
        text,
        tld="com",
        lang="en",
        slow=False,
        lang_check=True,
        pre_processor_funcs=[
            pre_processors.tone_marks,
            pre_processors.end_of_line,
            pre_processors.abbreviations,
            pre_processors.word_sub,
        ],
        tokenizer_func=Tokenizer(
            [
                tokenizer_cases.tone_marks,
                tokenizer_cases.period_comma,
                tokenizer_cases.colon,
                tokenizer_cases.other_punctuation,
            ]
        ).run,
        timeout=None,
    ):
        # Debug
        for k, v in dict(locals()).items():
            if k == "self":
                continue
            log.debug("%s: %s", k, v)

        # Text
        assert text, "No text to speak"
        self.text = text

        # Translate URL top-level domain
        self.tld = tld

        # Language
        self.lang_check = lang_check
        self.lang = lang

        if self.lang_check:
            # Fallback lang in case it is deprecated
            self.lang = _fallback_deprecated_lang(lang)

            try:
                langs = tts_langs()
                if self.lang not in langs:
                    raise ValueError("Language not supported: %s" % lang)
            except RuntimeError as e:
                log.debug(str(e), exc_info=True)
                log.warning(str(e))

        # Read speed
        if slow:
            self.speed = Speed.SLOW
        else:
            self.speed = Speed.NORMAL

        # Pre-processors and tokenizer
        self.pre_processor_funcs = pre_processor_funcs
        self.tokenizer_func = tokenizer_func

        self.timeout = timeout

    def _tokenize(self, text):
        # Pre-clean
        text = text.strip()

        # Apply pre-processors
        for pp in self.pre_processor_funcs:
            log.debug("pre-processing: %s", pp)
            text = pp(text)

        if len(text) <= self.GOOGLE_TTS_MAX_CHARS:
            return _clean_tokens([text])

        # Tokenize
        log.debug("tokenizing: %s", self.tokenizer_func)
        tokens = self.tokenizer_func(text)

        # Clean
        tokens = _clean_tokens(tokens)

        # Minimize
        min_tokens = []
        for t in tokens:
            min_tokens += _minimize(t, " ", self.GOOGLE_TTS_MAX_CHARS)

        # Filter empty tokens, post-minimize
        tokens = [t for t in min_tokens if t]

        return tokens

    def _package_rpc(self, text):
        parameter = [text, self.lang, self.speed, "null"]
        escaped_parameter = json.dumps(parameter, separators=(",", ":"))

        rpc = [[[self.GOOGLE_TTS_RPC, escaped_parameter, None, "generic"]]]
        espaced_rpc = json.dumps(rpc, separators=(",", ":"))
        return "f.req={}&".format(urllib.parse.quote(espaced_rpc))

    def _prepare_request_payloads(self):
        """Prepare the TTS API request payloads.

        Returns:
            list: A list of dicts containing method, url, data, headers.
        """
        # TTS API URL
        translate_url = _translate_url(tld=self.tld, path="_/TranslateWebserverUi/data/batchexecute")

        text_parts = self._tokenize(self.text)
        log.debug("text_parts: %s", str(text_parts))
        log.debug("text_parts: %i", len(text_parts))
        assert text_parts, "No text to send to TTS API"

        payloads = []
        for idx, part in enumerate(text_parts):
            data = self._package_rpc(part)

            log.debug("data-%i: %s", idx, data)

            payloads.append(
                {
                    "method": "POST",
                    "url": translate_url,
                    "data": data,
                    "headers": self.GOOGLE_TTS_HEADERS,
                }
            )

        return payloads

    def _prepare_requests(self):
        """Created the TTS API the request(s) without sending them.

        Returns:
            list: ``httpx.Request``.
        """
        payloads = self._prepare_request_payloads()
        prepared_requests = []
        for payload in payloads:
            # Request
            r = httpx.Request(
                method=payload["method"],
                url=payload["url"],
                content=payload["data"],
                headers=payload["headers"],
            )
            # Prepare request
            prepared_requests.append(r)
        return prepared_requests

    def get_bodies(self):
        """Get TTS API request bodies(s) that would be sent to the TTS API.

        Returns:
            list: A list of TTS API request bodies to make.
        """
        return [pr.body for pr in self._prepare_requests()]


class gTTS(_gTTS):
    def stream(self):
        """Do the TTS API request(s) and stream bytes

        Raises:
            :class:`gTTSError`: When there's an error with the API request.

        """
        prepared_requests = self._prepare_requests()

        for idx, pr in enumerate(prepared_requests):
            try:
                with httpx.Client(verify=False, timeout=self.timeout) as client:
                    r = client.send(request=pr)

                log.debug("headers-%i: %s", idx, r.headers)
                log.debug("url-%i: %s", idx, r.url)
                log.debug("status-%i: %s", idx, r.status_code)

                r.raise_for_status()
            except httpx.HTTPStatusError as e:  # pragma: no cover
                # Request successful, bad response
                log.debug(str(e))
                raise gTTSError(tts=self, response=r)
            except httpx.RequestError as e:  # pragma: no cover
                # Request failed
                log.debug(str(e))
                raise gTTSError(tts=self)

            # Write
            for line in r.iter_lines():
                if "jQ1olc" in line:
                    audio_search = re.search(r'jQ1olc","\[\\"(.*)\\"]', line)
                    if audio_search:
                        as_bytes = audio_search.group(1).encode("ascii")
                        yield base64.b64decode(as_bytes)
                    else:
                        # Request successful, good response,
                        # no audio stream in response
                        raise gTTSError(tts=self, response=r)
            log.debug("part-%i created", idx)

    def write_to_fp(self, fp):
        """Do the TTS API request(s) and write bytes to a file-like object.

        Args:
            fp (file object): Any file-like object to write the ``mp3`` to.

        Raises:
            :class:`gTTSError`: When there's an error with the API request.
            TypeError: When ``fp`` is not a file-like object that takes bytes.

        """

        try:
            for idx, decoded in enumerate(self.stream()):
                fp.write(decoded)
                log.debug("part-%i written to %s", idx, fp)
        except (AttributeError, TypeError) as e:
            raise TypeError("'fp' is not a file-like object or it does not take bytes: %s" % str(e))

    def save(self, savefile):
        """Do the TTS API request and write result to file.

        Args:
            savefile (string): The path and file name to save the ``mp3`` to.

        Raises:
            :class:`gTTSError`: When there's an error with the API request.

        """
        with open(str(savefile), "wb") as f:
            self.write_to_fp(f)
            f.flush()
            log.debug("Saved to %s", savefile)


class agTTS(_gTTS):
    async def stream(self):
        """Do the TTS API request(s) and stream bytes

        Raises:
            :class:`gTTSError`: When there's an error with the API request.

        """
        prepared_requests = self._prepare_requests()

        for idx, pr in enumerate(prepared_requests):
            try:
                async with httpx.AsyncClient(verify=False, timeout=self.timeout) as client:
                    r = await client.send(request=pr)

                log.debug("headers-%i: %s", idx, r.headers)
                log.debug("url-%i: %s", idx, r.url)
                log.debug("status-%i: %s", idx, r.status_code)

                r.raise_for_status()
            except httpx.HTTPStatusError as e:  # pragma: no cover
                # Request successful, bad response
                log.debug(str(e))
                raise gTTSError(tts=self, response=r)
            except httpx.RequestError as e:  # pragma: no cover
                # Request failed
                log.debug(str(e))
                raise gTTSError(tts=self)

            # Write
            async for line in r.aiter_lines():
                if "jQ1olc" in line:
                    audio_search = re.search(r'jQ1olc","\[\\"(.*)\\"]', line)
                    if audio_search:
                        as_bytes = audio_search.group(1).encode("ascii")
                        yield base64.b64decode(as_bytes)
                    else:
                        # Request successful, good response,
                        # no audio stream in response
                        raise gTTSError(tts=self, response=r)
            log.debug("part-%i created", idx)

    async def write_to_fp(self, fp):
        """Do the TTS API request(s) and write bytes to a file-like object.

        Args:
            fp (file object): Any file-like object to write the ``mp3`` to.

        Raises:
            :class:`gTTSError`: When there's an error with the API request.
            TypeError: When ``fp`` is not a file-like object that takes bytes.

        """

        try:
            idx = 0
            async for decoded in self.stream():
                fp.write(decoded)
                log.debug("part-%i written to %s", idx, fp)
                idx += 1
        except (AttributeError, TypeError) as e:
            raise TypeError("'fp' is not a file-like object or it does not take bytes: %s" % str(e))

    async def save(self, savefile):
        """Do the TTS API request and write result to file.

        Args:
            savefile (string): The path and file name to save the ``mp3`` to.

        Raises:
            :class:`gTTSError`: When there's an error with the API request.

        """
        with open(str(savefile), "wb") as f:
            await self.write_to_fp(f)
            f.flush()
            log.debug("Saved to %s", savefile)


class gTTSError(Exception):
    """Exception that uses context to present a meaningful error message"""

    def __init__(self, msg=None, **kwargs):
        self.tts = kwargs.pop("tts", None)
        self.rsp = kwargs.pop("response", None)
        if msg:
            self.msg = msg
        elif self.tts is not None:
            self.msg = self.infer_msg(self.tts, self.rsp)
        else:
            self.msg = None
        super(gTTSError, self).__init__(self.msg)

    def infer_msg(self, tts, rsp=None):
        """Attempt to guess what went wrong by using known
        information (e.g. http response) and observed behaviour

        """
        cause = "Unknown"

        if rsp is None:
            premise = "Failed to connect"

            if tts.tld != "com":
                host = _translate_url(tld=tts.tld)
                cause = "Host '{}' is not reachable".format(host)

        else:
            # rsp should be <httpx.Response>
            # http://docs.python-requests.org/en/master/api/
            status = rsp.status_code
            reason = getattr(rsp, "reason", getattr(rsp, "reason_phrase", "Unknown"))

            premise = "{:d} ({}) from TTS API".format(status, reason)

            if status == 403:
                cause = "Bad token or upstream API changes"
            elif status == 404 and tts.tld != "com":
                cause = "Unsupported tld '{}'".format(tts.tld)
            elif status == 200 and not tts.lang_check:
                cause = "No audio stream in response. Unsupported language '%s'" % self.tts.lang
            elif status >= 500:
                cause = "Upstream API error. Try again later."

        return "{}. Probable cause: {}".format(premise, cause)
