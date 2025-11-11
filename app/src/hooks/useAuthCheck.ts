import React from "react";
import { useSetAtom } from "jotai";

import { useAuthQuery } from "~/client";
import { $authed } from "~/store";

const useAuthCheck = () => {
  const setAuthed = useSetAtom($authed);

  const query = useAuthQuery();

  React.useEffect(() => {
    setAuthed(query.isSuccess);
  }, [query.isSuccess, setAuthed]);

  return [query.isPending, query.error] as const;
};

export default useAuthCheck;
