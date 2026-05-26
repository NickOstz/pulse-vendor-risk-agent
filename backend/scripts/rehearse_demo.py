import argparse
import json

from app.services.demo_rehearsal import RehearsalConfig, RehearsalError, run_demo_rehearsal


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the Pulse Cloudflare demo flow against a disposable database."
    )
    parser.add_argument(
        "--mode",
        choices=["replay", "live_with_fallback"],
        default="replay",
        help="Use credential-free replay by default; live mode requires local backend Bright Data configuration.",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=2.0,
        help="Polling cadence used while observing review stages.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=180.0,
        help="Fail if the end-to-end rehearsal exceeds this time budget.",
    )
    args = parser.parse_args()

    try:
        report = run_demo_rehearsal(
            RehearsalConfig(
                mode=args.mode,
                poll_interval_seconds=args.poll_interval_seconds,
                timeout_seconds=args.timeout_seconds,
            )
        )
    except (RehearsalError, ValueError) as error:
        print(f"Rehearsal failed: {error}")
        return 1

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
