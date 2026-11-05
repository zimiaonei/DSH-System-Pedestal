
import json, os, glob, datetime, collections
from compression import zstd

base = os.path.expanduser(r"~\.dsh\sessions")
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
print(f"Current local time: {now}")

# Find all session.v4.jsonl.zstd
files = glob.glob(os.path.join(base, "**", "session.v4.jsonl.zstd"), recursive=True)
print(f"Total session files found: {len(files)}")

# Parse events and collect usage
session_stats = []

for fpath in files:
    try:
        data = open(fpath, "rb").read()
        if not data:
            continue
        try:
            raw = zstd.decompress(data)
            text = raw.decode("utf-8", errors="ignore")
        except Exception as e:
            continue
            
        lines = text.splitlines()
        session_title = ""
        session_id = os.path.basename(os.path.dirname(fpath))
        
        per_model = collections.defaultdict(lambda: collections.Counter())
        total_session_counter = collections.Counter()
        first_time = None
        last_time = None
        message_count = 0
        
        for ln in lines:
            if not ln.strip():
                continue
            try:
                ev = json.loads(ln)
            except Exception:
                continue
                
            t_ms = ev.get("time")
            if t_ms:
                ev_time = datetime.datetime.fromtimestamp(t_ms/1000, datetime.timezone(datetime.timedelta(hours=8)))
                if first_time is None or ev_time < first_time:
                    first_time = ev_time
                if last_time is None or ev_time > last_time:
                    last_time = ev_time
                    
            if ev.get("type") == "session/created":
                session_title = ev.get("data", {}).get("title", "")
                
            if ev.get("type") == "assistant/message":
                data_field = ev.get("data", {})
                usage = data_field.get("usage")
                if usage:
                    message_count += 1
                    msg = data_field.get("message", {})
                    source = msg.get("source", {})
                    provider = source.get("provider", "unknown")
                    model = source.get("model", "unknown")
                    mkey = f"{provider}/{model}"
                    
                    for k in ("inputTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens", "totalTokens"):
                        v = usage.get(k, 0)
                        per_model[mkey][k] += v
                        total_session_counter[k] += v
                        
        if total_session_counter["totalTokens"] > 0:
            session_stats.append({
                "id": session_id,
                "title": session_title,
                "first_time": first_time,
                "last_time": last_time,
                "message_count": message_count,
                "per_model": per_model,
                "totals": total_session_counter
            })
    except Exception as e:
        pass

print(f"Sessions with token usage: {len(session_stats)}\n")

# Filter for today (2026-11-04 and 2026-11-05, noting user might refer to the current working day / 11-04 ~ 11-05)
# Let's inspect by calendar date (local time)
date_groups = collections.defaultdict(list)
for s in session_stats:
    if s["first_time"]:
        d_key = s["first_time"].strftime("%Y-%m-%d")
        date_groups[d_key].append(s)

for d_key in sorted(date_groups.keys()):
    print(f"=== DATE: {d_key} ===")
    day_sessions = date_groups[d_key]
    day_models = collections.defaultdict(lambda: collections.Counter())
    day_total = collections.Counter()
    
    for s in sorted(day_sessions, key=lambda x: x["first_time"]):
        ft_str = s["first_time"].strftime("%H:%M:%S")
        lt_str = s["last_time"].strftime("%H:%M:%S") if s["last_time"] else ""
        print(f"[{ft_str}-{lt_str}] {s['id'][:18]} | {s['title'][:32]} | steps: {s['message_count']}")
        for mkey, u in s["per_model"].items():
            for k in u:
                day_models[mkey][k] += u[k]
                day_total[k] += u[k]
            print(f"    {mkey:30} in: {u['inputTokens']:,} | cacheRd: {u['cacheReadTokens']:,} | out: {u['outputTokens']:,} | tot: {u['totalTokens']:,}")
            
    print(f"\n--- SUMMARY FOR {d_key} ---")
    for mkey, u in day_models.items():
        print(f"  Model: {mkey}")
        print(f"    inputTokens:      {u['inputTokens']:,}")
        print(f"    cacheReadTokens:  {u['cacheReadTokens']:,}")
        print(f"    cacheWriteTokens: {u['cacheWriteTokens']:,}")
        print(f"    outputTokens:     {u['outputTokens']:,}")
        print(f"    totalTokens:      {u['totalTokens']:,}")
    print("  Day Grand Total:", dict(day_total))
    print("="*80 + "\n")
