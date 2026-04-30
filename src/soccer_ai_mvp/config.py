from __future__ import annotations

from pathlib import Path
from typing import Any, Union

import yaml


def load_config(path: Union[str, Path]) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)
