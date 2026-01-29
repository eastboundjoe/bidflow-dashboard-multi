from datetime import datetime, timedelta

def get_report_dates():
    
    # Replaces the 'Edit Fields' n8n node logic.
    # Calculates today, yesterday, and various lookback windows.
    
    now = datetime.now()
    
    dates = {
        "today": now.strftime("%Y-%m-%d"),
        "yesterday": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
        "dayBefore": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
        # n8n node used 9 days for startDate7 and 33 for startDate30
        "startDate7": (now - timedelta(days=9)).strftime("%Y-%m-%d"),
        "startDate30": (now - timedelta(days=33)).strftime("%Y-%m-%d"),
        "endDate": (now - timedelta(days=3)).strftime("%Y-%m-%d")
    }
    return dates

if __name__ == "__main__":
    # Test the tool
    print("📅 Calculating Amazon Reporting Windows...")
    for label, date in get_report_dates().items():
        print(f"{label}: {date}")