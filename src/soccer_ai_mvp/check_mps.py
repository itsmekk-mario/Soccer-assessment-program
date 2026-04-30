def main() -> None:
    import torch

    print(f"PyTorch: {torch.__version__}")
    print(f"MPS built: {torch.backends.mps.is_built()}")
    print(f"MPS available: {torch.backends.mps.is_available()}")

    if torch.backends.mps.is_available():
        device = torch.device("mps")
        x = torch.ones(5, device=device)
        y = x * 2
        print(f"MPS test tensor: {y.cpu().tolist()}")
        print("권장 device: mps")
    else:
        print("권장 device: cpu")


if __name__ == "__main__":
    main()

