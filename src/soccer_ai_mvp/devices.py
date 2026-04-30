from __future__ import annotations


def select_device(requested: str) -> str:
    if requested != "auto":
        return requested

    import torch

    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"

