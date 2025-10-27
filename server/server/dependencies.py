from typing import Annotated

from fastapi import Depends, Request

from server.core import Yaplingo as _Yaplingo


async def yaplingo(request: Request) -> _Yaplingo:
    return request.app.state.yaplingo


Yaplingo = Annotated[_Yaplingo, Depends(yaplingo)]
