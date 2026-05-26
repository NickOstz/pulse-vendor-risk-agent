import argparse
import json

from app.services.extraction_evaluation import run_extraction_evaluation


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the five-page Pulse structured extraction quality gate."
    )
    parser.add_argument(
        "--mode",
        choices=["recorded_baseline", "deepseek"],
        default="recorded_baseline",
        help="Use seeded expected outputs by default; DeepSeek mode requires a locally configured API key.",
    )
    args = parser.parse_args()

    try:
        report = run_extraction_evaluation(mode=args.mode)
    except ValueError as error:
        print(f"Evaluation failed: {error}")
        return 1

    print(json.dumps(report, indent=2))
    return 0 if report["quality_gate_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
