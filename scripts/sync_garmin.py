#!/usr/bin/env python3
import sys
import argparse
import datetime
import json
import urllib.request
import urllib.error

# For 2026 TLS fingerprinting bypass, python-garminconnect uses internal mechanisms or falls back.
# We import it and wrap it in a robust try/except.
try:
    from garminconnect import Garmin
except ImportError:
    print("Błąd: Biblioteka 'garminconnect' nie jest zainstalowana w tym środowisku Python.")
    print("Spróbuj zainstalować: pip install garminconnect")
    sys.exit(1)

def parse_args():
    parser = argparse.ArgumentParser(description="Synchronizacja danych Garmin Connect z healthOS")
    parser.add_argument("--email", required=True, help="Email logowania Garmin Connect")
    parser.add_argument("--user-id", required=True, help="ID użytkownika w systemie healthOS")
    parser.add_argument("--app-url", default="http://localhost:3000", help="Bazowy adres URL aplikacji healthOS")
    parser.add_argument("--days", type=int, default=3, help="Liczba dni wstecz do synchronizacji")
    parser.add_argument(
        "--stdin-secrets",
        action="store_true",
        help='ZALECANE. Wczytaj hasło i token z jednej linii JSON na stdin: '
             '{"password": "...", "secret": "..."}',
    )
    # Furtka do ręcznego uruchomienia z terminala. Odradzana: argumenty procesu
    # widzi w macOS każdy inny program działający na tym koncie (`ps aux`).
    parser.add_argument("--password", help="Hasło Garmin Connect (odradzane — użyj --stdin-secrets)")
    parser.add_argument("--secret", help="Token do Ingest API (odradzane — użyj --stdin-secrets)")
    return parser.parse_args()


def resolve_secrets(args):
    """Zwraca (hasło, token). Domyślna i zalecana droga to stdin."""
    if args.stdin_secrets:
        raw = sys.stdin.readline()
        if not raw.strip():
            print("Błąd: --stdin-secrets ustawione, ale nie otrzymano nic na stdin.")
            sys.exit(2)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            print("Błąd: dane na stdin nie są poprawnym JSON-em.")
            sys.exit(2)
        password, secret = data.get("password"), data.get("secret")
    else:
        password, secret = args.password, args.secret

    if not password:
        print("Błąd: brak hasła. Użyj --stdin-secrets (zalecane) albo --password.")
        sys.exit(2)
    if not secret:
        print("Błąd: brak tokenu ingest. Użyj --stdin-secrets (zalecane) albo --secret.")
        sys.exit(2)
    return password, secret

def fetch_garmin_data(email, password, days):
    if email == "test@test.pl":
        print("Wykryto konto testowe. Generowanie danych demonstracyjnych Garmin...")
        today = datetime.date.today()
        sleep_data_list = []
        daily_metrics_list = []
        activities_list = []
        hr_samples_list = []
        
        for i in range(days):
            date_to_sync = today - datetime.timedelta(days=i)
            date_str = date_to_sync.isoformat()
            
            # Generuj stabilne, ale rozne dane na podstawie indeksu
            steps = 8000 + (i * 1250) % 6000
            resting_hr = 50 + (i * 2) % 10
            hrv = 55 + (i * 5) % 25
            spo2 = 96 + (i * 1) % 4
            stress_score = 15 + (i * 8) % 35
            active_calories = 250 + (i * 90) % 500
            total_calories = 2000 + active_calories
            
            # Body Battery trend (24 próbki, co godzinę)
            body_battery_trend = []
            stress_trend = []
            for hour in range(24):
                # Generujemy ładny cykl dobowy: spadek w dzień, ładowanie w nocy
                bb_val = 80 - int(30 * (1 - abs(hour - 14) / 10.0))
                bb_val = max(15, min(99, bb_val))
                if hour < 6 or hour > 22: # sen
                    bb_val = min(99, bb_val + (hour if hour < 6 else (hour - 22)) * 5)
                body_battery_trend.append({
                    "timestamp": f"{date_str}T{hour:02d}:00:00Z",
                    "value": bb_val
                })
                
                # Stres rośnie w ciągu dnia, spada w nocy
                st_val = 25 + int(20 * (1 - abs(hour - 14) / 10.0))
                st_val = max(5, min(95, st_val))
                if hour < 6 or hour > 22:
                    st_val = max(3, st_val - 20)
                stress_trend.append({
                    "timestamp": f"{date_str}T{hour:02d}:00:00Z",
                    "value": st_val
                })

                # Próbki tętna co godzinę
                hr_val = resting_hr + int((st_val / 3.0))
                if i % 2 == 1 and hour == 18: # trening w tym czasie
                    hr_val = 145
                hr_samples_list.append({
                    "recordedAt": f"{date_str}T{hour:02d}:00:00Z",
                    "bpm": hr_val,
                    "type": "resting" if hour < 6 or hour > 22 else "active"
                })
            
            daily_metrics_list.append({
                "date": date_str,
                "steps": steps,
                "restingHr": resting_hr,
                "hrv": hrv,
                "spo2": spo2,
                "stressScore": stress_score,
                "activeCalories": active_calories,
                "totalCalories": total_calories,
                "bodyBatteryMax": 95 - (i * 5) % 30,
                "bodyBatteryMin": 25 + (i * 3) % 15,
                "bodyBatteryTrend": body_battery_trend,
                "stressTrend": stress_trend,
                "vo2max": 52.0 + (i * 0.2) % 2.0
            })
            
            # Dane snu (dla dni w przeszlosci)
            if i > 0:
                bed_ts = datetime.datetime.combine(date_to_sync - datetime.timedelta(days=1), datetime.time(22, 45))
                wake_ts = datetime.datetime.combine(date_to_sync, datetime.time(6, 45))
                
                total_mins = 480 + (i * 20) % 90
                deep_mins = 110 + (i * 10) % 40
                rem_mins = 90 + (i * 5) % 30
                light_mins = total_mins - deep_mins - rem_mins - 30
                awake_mins = 30
                efficiency = 80 + (i * 3) % 15
                
                sleep_data_list.append({
                    "date": date_str,
                    "bedAt": bed_ts.isoformat() + "Z",
                    "wakeAt": wake_ts.isoformat() + "Z",
                    "totalMinutes": int(total_mins),
                    "deepMinutes": int(deep_mins),
                    "remMinutes": int(rem_mins),
                    "lightMinutes": int(light_mins),
                    "awakeMinutes": int(awake_mins),
                    "efficiency": float(efficiency)
                })
            
            # Generuj trening raz na dwa dni (np. wczoraj i 3 dni temu)
            if i % 2 == 1:
                # 18:00 trening
                started_dt = datetime.datetime.combine(date_to_sync, datetime.time(18, 0))
                # Przesunięcie o 45 minut
                duration_sec = 2700
                distance_m = 7500.0
                calories = 520
                
                activities_list.append({
                    "sourceId": f"mock-garmin-act-{date_str}",
                    "name": "Bieg w terenie (Garmin)",
                    "type": "RUN",
                    "startedAt": started_dt.isoformat() + "Z",
                    "duration": duration_sec,
                    "elapsedTime": duration_sec + 120,
                    "distance": distance_m,
                    "avgHr": 145,
                    "maxHr": 168,
                    "calories": calories,
                    "avgSpeed": 2.78, # m/s
                    "vo2max": 52.4,
                    "trainingEffectAerobic": 3.8,
                    "trainingEffectAnaerobic": 1.5,
                    "trainingLoad": 135
                })

        return {
            "userId": email,
            "sleep": sleep_data_list,
            "dailyMetrics": daily_metrics_list,
            "activities": activities_list,
            "heartRateSamples": hr_samples_list
        }

    print(f"Logowanie do Garmin Connect ({email})...")
    try:
        # Initialize client
        client = Garmin(email, password)
        client.login()
        print("Zalogowano pomyślnie.")
    except Exception as e:
        print(f"Błąd logowania do Garmin Connect: {e}")
        sys.exit(2)

    today = datetime.date.today()
    sleep_data_list = []
    daily_metrics_list = []
    activities_list = []
    hr_samples_list = []

    # Pobierz ostatnie 20 aktywności i przefiltruj
    all_activities = []
    try:
        print("Pobieranie historii aktywności...")
        all_activities = client.get_activities(0, 20)
    except Exception as e:
        print(f"  [Ostrzeżenie] Nie można pobrać aktywności: {e}")

    for i in range(days):
        date_to_sync = today - datetime.timedelta(days=i)
        date_str = date_to_sync.isoformat()
        print(f"Pobieranie danych dla dnia: {date_str}...")

        # 1. Metryki dzienne (kroki, kalorie, tętno spoczynkowe)
        steps = None
        resting_hr = None
        hrv = None
        spo2 = None
        stress_score = None
        active_calories = None
        total_calories = None
        body_battery_max = None
        body_battery_min = None
        body_battery_trend = []
        stress_trend = []
        vo2max = None

        try:
            stats = client.get_stats_by_date(date_str)
            if stats:
                steps = stats.get("totalSteps") or stats.get("steps")
                resting_hr = stats.get("restingHeartRate") or stats.get("restingHR")
                active_calories = stats.get("activeKilocalories") or stats.get("activeCalories")
                total_calories = stats.get("totalKilocalories") or stats.get("totalCalories")
        except Exception as e:
            print(f"  [Ostrzeżenie] Nie można pobrać ogólnych statystyk: {e}")

        # 2. HRV (zazwyczaj jako HRV status)
        try:
            hrv_data = client.get_hrv_data(date_str)
            if hrv_data and "hrvSummary" in hrv_data:
                hrv = hrv_data["hrvSummary"].get("weeklyAverage") or hrv_data["hrvSummary"].get("lastNightAverage")
        except Exception as e:
            pass

        # 3. SpO2 (Pulse Ox)
        try:
            spo2_data = client.get_spo2_data(date_str)
            if spo2_data and "spo2Summary" in spo2_data:
                spo2 = spo2_data["spo2Summary"].get("averageSpo2")
        except Exception as e:
            pass

        # 4. Stres i trend stresu
        try:
            stress_data = client.get_stress_data(date_str)
            if stress_data:
                stress_score = stress_data.get("avgStressLevel") or stress_data.get("averageStressLevel")
                # Próbki stresu w ciągu dnia
                stress_values = stress_data.get("stressValuesArray") or stress_data.get("stressValues")
                if isinstance(stress_values, list):
                    for st_val in stress_values:
                        if isinstance(st_val, list) and len(st_val) >= 2:
                            # st_val format: [timestamp_ms, value]
                            ts = datetime.datetime.fromtimestamp(st_val[0]/1000.0, datetime.timezone.utc).isoformat()
                            stress_trend.append({
                                "timestamp": ts,
                                "value": st_val[1]
                            })
        except Exception as e:
            print(f"  [Ostrzeżenie] Nie można pobrać poziomu stresu: {e}")

        # 5. Body Battery
        try:
            # W niektórych wersjach garminconnect jest get_body_battery_data lub get_body_battery
            bb_data = None
            if hasattr(client, 'get_body_battery'):
                bb_data = client.get_body_battery(date_str)
            elif hasattr(client, 'get_body_battery_data'):
                bb_data = client.get_body_battery_data(date_str)
            
            if bb_data:
                # Szukamy min/max oraz próbek w ciągu dnia
                # bb_data format: zazwyczaj lista słowników ze szczegółami lub słownik
                if isinstance(bb_data, list):
                    vals = [x.get("value") for x in bb_data if x.get("value") is not None]
                    if vals:
                        body_battery_min = min(vals)
                        body_battery_max = max(vals)
                    for x in bb_data:
                        ts = x.get("date") # w formacie ISO string lub timestamp
                        val = x.get("value")
                        if ts and val is not None:
                            body_battery_trend.append({
                                "timestamp": ts,
                                "value": val
                            })
        except Exception as e:
            print(f"  [Ostrzeżenie] Nie można pobrać danych Body Battery: {e}")

        # 6. VO2max i status treningowy
        try:
            # client.get_training_status(date_str)
            training_status = client.get_training_status(date_str)
            if training_status:
                # VO2max z treningu
                vo2max = training_status.get("vo2MaxPrecision") or training_status.get("vo2Max")
        except Exception as e:
            pass

        # Zapisz metryki dzienne
        daily_metrics_list.append({
            "date": date_str,
            "steps": steps,
            "restingHr": resting_hr,
            "hrv": hrv,
            "spo2": spo2,
            "stressScore": stress_score,
            "activeCalories": active_calories,
            "totalCalories": total_calories,
            "bodyBatteryMax": body_battery_max,
            "bodyBatteryMin": body_battery_min,
            "bodyBatteryTrend": body_battery_trend,
            "stressTrend": stress_trend,
            "vo2max": vo2max
        })

        # 7. Sen (bedAt, wakeAt, totalMinutes, fazy)
        try:
            sleep_stats = client.get_sleep_data(date_str)
            if sleep_stats and "dailySleepDTO" in sleep_stats:
                dto = sleep_stats["dailySleepDTO"]
                
                bed_at = None
                wake_at = None
                if dto.get("sleepStartTimestampGMT"):
                    start_ts = dto["sleepStartTimestampGMT"] / 1000.0
                    bed_at = datetime.datetime.fromtimestamp(start_ts, datetime.timezone.utc).isoformat()
                if dto.get("sleepEndTimestampGMT"):
                    end_ts = dto["sleepEndTimestampGMT"] / 1000.0
                    wake_at = datetime.datetime.fromtimestamp(end_ts, datetime.timezone.utc).isoformat()

                total_mins = dto.get("sleepTimeSeconds", 0) // 60
                deep_mins = dto.get("deepSleepSeconds", 0) // 60
                rem_mins = dto.get("remSleepSeconds", 0) // 60
                light_mins = dto.get("lightSleepSeconds", 0) // 60
                awake_mins = dto.get("awakeSleepSeconds", 0) // 60
                
                efficiency = dto.get("sleepScore")

                sleep_data_list.append({
                    "date": date_str,
                    "bedAt": bed_at,
                    "wakeAt": wake_at,
                    "totalMinutes": int(total_mins) if total_mins else None,
                    "deepMinutes": int(deep_mins) if deep_mins else None,
                    "remMinutes": int(rem_mins) if rem_mins else None,
                    "lightMinutes": int(light_mins) if light_mins else None,
                    "awakeMinutes": int(awake_mins) if awake_mins else None,
                    "efficiency": float(efficiency) if efficiency else None
                })
        except Exception as e:
            print(f"  [Ostrzeżenie] Nie można pobrać danych o śnie: {e}")

        # 8. Próbki tętna z całego dnia
        try:
            hr_data = client.get_heart_rates(date_str)
            if hr_data and "heartRateValues" in hr_data:
                hr_vals = hr_data["heartRateValues"]
                if isinstance(hr_vals, list):
                    for val in hr_vals:
                        if isinstance(val, list) and len(val) >= 2:
                            ts = datetime.datetime.fromtimestamp(val[0]/1000.0, datetime.timezone.utc).isoformat()
                            hr_samples_list.append({
                                "recordedAt": ts,
                                "bpm": val[1],
                                "type": "active" # domyślny typ
                            })
        except Exception as e:
            pass

    # Filtrujemy i mapujemy pobrane aktywności z Garmina
    start_date_limit = datetime.datetime.combine(today - datetime.timedelta(days=days), datetime.time.min, tzinfo=datetime.timezone.utc)
    for act in all_activities:
        start_time_str = act.get("startTimeGMT")
        if not start_time_str:
            continue
        # Format: "2026-06-03 18:00:00" -> parse to datetime
        try:
            act_dt = datetime.datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc)
        except Exception:
            continue

        if act_dt >= start_date_limit:
            # Mapowanie typu
            type_key = (act.get("activityType", {}).get("typeKey") or "").lower()
            act_type = "OTHER"
            if "running" in type_key:
                act_type = "RUN"
            elif "cycling" in type_key:
                act_type = "RIDE"
            elif "swimming" in type_key:
                act_type = "SWIM"
            elif "strength" in type_key:
                act_type = "STRENGTH"

            activities_list.append({
                "sourceId": str(act.get("activityId")),
                "name": act.get("activityName") or "Trening Garmin",
                "type": act_type,
                "startedAt": act_dt.isoformat(),
                "duration": int(act.get("duration") or 0),
                "elapsedTime": int(act.get("elapsedDuration") or 0),
                "distance": act.get("distance") or None,
                "avgHr": int(act.get("averageHR")) if act.get("averageHR") is not None else None,
                "maxHr": int(act.get("maxHR")) if act.get("maxHR") is not None else None,
                "calories": int(act.get("calories")) if act.get("calories") is not None else None,
                "avgSpeed": act.get("averageSpeed") or None,
                "vo2max": act.get("vo2MaxValue") or None,
                "trainingEffectAerobic": act.get("aerobicTrainingEffect") or None,
                "trainingEffectAnaerobic": act.get("anaerobicTrainingEffect") or None,
                "trainingLoad": act.get("activityTrainingLoad") or None
            })

    return {
        "userId": email,
        "sleep": sleep_data_list,
        "dailyMetrics": daily_metrics_list,
        "activities": activities_list,
        "heartRateSamples": hr_samples_list
    }

def send_data_to_api(payload, app_url, secret, userId):
    url = f"{app_url}/api/garmin/ingest"
    print(f"Wysyłanie danych do healthOS API ({url})...")
    
    # Overwrite payload userId with correct DB userId
    payload["userId"] = userId
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as res:
            response_body = res.read().decode("utf-8")
            response_json = json.loads(response_body)
            print("Dane zaimportowane pomyślnie do bazy!")
            print(f"Status: {response_json}")
    except urllib.error.HTTPError as e:
        print(f"Błąd HTTP podczas wysyłania danych: {e.code} - {e.reason}")
        print(e.read().decode("utf-8"))
        sys.exit(3)
    except Exception as e:
        print(f"Błąd połączenia z API: {e}")
        sys.exit(4)

def main():
    args = parse_args()
    password, secret = resolve_secrets(args)
    try:
        payload = fetch_garmin_data(args.email, password, args.days)
        send_data_to_api(payload, args.app_url, secret, args.user_id)
        print("Synchronizacja zakończona sukcesem!")
    except Exception as e:
        print(f"Błąd krytyczny skryptu: {e}")
        sys.exit(5)

if __name__ == "__main__":
    main()
