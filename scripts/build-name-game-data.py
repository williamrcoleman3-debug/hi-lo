import pandas as pd, glob, json, re, collections

KEEP_WEEKLY = {"ACT", "RES", "INA", "PUP", "NWT", "SUS", "RSN", "RSR", "EXE"}
DROP_SEASON = {"DEV", "CUT", "UFA", "RFA", "RLS", "E14"}

# ---- season files (1932-2001)
rows = []
for f in sorted(glob.glob("/home/claude/data/roster_*.csv")):
    y = int(re.findall(r"(\d{4})", f)[0])
    if y < 1932 or y >= 2002:
        continue
    d = pd.read_csv(f, low_memory=False)
    d = d[~d.status.isin(DROP_SEASON)]
    rows.append(d[["season", "team", "position", "full_name", "birth_date", "gsis_id"]])
# ---- weekly files (2002+)
for f in sorted(glob.glob("/home/claude/weekly/w_*.csv")):
    d = pd.read_csv(f, low_memory=False,
                    usecols=["season", "team", "position", "full_name", "birth_date", "gsis_id", "status"])
    d = d[d.status.isin(KEEP_WEEKLY)]
    rows.append(d[["season", "team", "position", "full_name", "birth_date", "gsis_id"]])
df = pd.concat(rows, ignore_index=True)
df = df[df.full_name.notna()]
df["full_name"] = df.full_name.str.strip().str.replace(r"\s+", " ", regex=True)

ALIAS = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU", "SL": "STL"}
df["team"] = df.team.replace(ALIAS)


def franchise_and_name(t, y):
    """Return (franchise_key, display team name) for a team code in a season."""
    if t == "ARI": return "ARI", "Arizona Cardinals"
    if t == "PHO": return "ARI", "Phoenix Cardinals"
    if t == "CHC": return "ARI", "Chicago Cardinals"
    if t == "STL":
        if y == 1934: return "STLG", "St. Louis Gunners"
        if y <= 1987: return "ARI", "St. Louis Cardinals"
        return "LAR", "St. Louis Rams"
    if t == "CLE":
        if y <= 1945: return "LAR", "Cleveland Rams"
        return "CLE", "Cleveland Browns"
    if t in ("RAM",): return "LAR", "Los Angeles Rams"
    if t == "LA": return "LAR", "Los Angeles Rams"
    if t == "BAL":
        if y <= 1950: return "BALC", "Baltimore Colts (1947-50)"
        if y <= 1983: return "IND", "Baltimore Colts"
        return "BAL", "Baltimore Ravens"
    if t == "IND": return "IND", "Indianapolis Colts"
    if t == "HOU":
        if y <= 1996: return "TEN", "Houston Oilers"
        return "HOU", "Houston Texans"
    if t == "TEN": return "TEN", "Tennessee Oilers" if y <= 1998 else "Tennessee Titans"
    if t == "BOS":
        if y <= 1936: return "WAS", "Boston Redskins"
        return "NE", "Boston Patriots"
    if t == "NE": return "NE", "New England Patriots"
    if t == "WAS":
        if y <= 2019: return "WAS", "Washington Redskins"
        if y <= 2021: return "WAS", "Washington Football Team"
        return "WAS", "Washington Commanders"
    if t == "CIN":
        if y <= 1934: return "CINR", "Cincinnati Reds"
        return "CIN", "Cincinnati Bengals"
    if t == "BUF":
        if y <= 1949: return "BUFB", "Buffalo Bills (AAFC)"
        return "BUF", "Buffalo Bills"
    if t == "MIA":
        if y <= 1946: return "MIAS", "Miami Seahawks"
        return "MIA", "Miami Dolphins"
    if t == "DAL":
        if y <= 1952: return "DALT", "Dallas Texans (1952)"
        return "DAL", "Dallas Cowboys"
    if t == "COW": return "DAL", "Dallas Cowboys"
    if t == "TEX": return "KC", "Dallas Texans"
    if t == "KC": return "KC", "Kansas City Chiefs"
    if t == "CHR":
        if y >= 1960: return "LAC", "Los Angeles Chargers"
        return "CHR", "Chicago Rockets/Hornets"
    if t == "SD": return "LAC", "San Diego Chargers"
    if t == "LAC": return "LAC", "Los Angeles Chargers"
    if t == "OAK": return "LV", "Oakland Raiders"
    if t == "RAI": return "LV", "Los Angeles Raiders"
    if t == "LV": return "LV", "Las Vegas Raiders"
    if t in ("NY", "NYG"): return "NYG", "New York Giants"
    if t == "NYT": return "NYJ", "New York Titans"
    if t == "NYJ": return "NYJ", "New York Jets"
    if t == "NYY": return "NYY", "New York Yankees/Yanks"
    if t == "NYB": return "NYB", "New York Bulldogs"
    if t == "BRK": return "BRK", "Brooklyn Dodgers/Tigers"
    if t in ("CHB", "CHI"): return "CHI", "Chicago Bears"
    if t == "CHH": return "CHH", "Chicago Hornets"
    if t == "POR": return "DET", "Portsmouth Spartans"
    if t == "DET": return "DET", "Detroit Lions"
    if t == "SI": return "SI", "Staten Island Stapletons"
    if t == "DON": return "DON", "Los Angeles Dons"
    if t == "C-P": return "C-P", "Card-Pitt"
    if t == "P-P": return "P-P", "Phil-Pitt Steagles"
    if t == "PHI": return "PHI", "Philadelphia Eagles"
    if t == "PIT": return "PIT", "Pittsburgh Steelers"
    if t == "GB": return "GB", "Green Bay Packers"
    if t == "SF": return "SF", "San Francisco 49ers"
    if t == "DEN": return "DEN", "Denver Broncos"
    if t == "MIN": return "MIN", "Minnesota Vikings"
    if t == "ATL": return "ATL", "Atlanta Falcons"
    if t == "NO": return "NO", "New Orleans Saints"
    if t == "SEA": return "SEA", "Seattle Seahawks"
    if t == "TB": return "TB", "Tampa Bay Buccaneers"
    if t == "CAR": return "CAR", "Carolina Panthers"
    if t == "JAX": return "JAX", "Jacksonville Jaguars"
    raise ValueError((t, y))


# ---- player identity: name+birthdate, falling back to gsis id
df["bd"] = df.birth_date.fillna("")
gsis_to_bd = (df[(df.bd != "") & df.gsis_id.notna()]
              .groupby(["gsis_id"]).bd.first().to_dict())
miss = (df.bd == "") & df.gsis_id.notna()
df.loc[miss, "bd"] = df.loc[miss, "gsis_id"].map(gsis_to_bd).fillna("")
df["key"] = df.full_name + "|" + df.bd
nobd = df.bd == ""
df.loc[nobd, "key"] = df.loc[nobd, "full_name"] + "|g" + df.loc[nobd, "gsis_id"].fillna("x").astype(str)

df = df.drop_duplicates(["key", "team", "season"])

teams = {}      # (code, season) -> index
team_list = []  # [label, franchise, season, code]
fr = {}
for (t, y) in sorted(set(zip(df.team, df.season))):
    f, name = franchise_and_name(t, int(y))
    teams[(t, y)] = len(team_list)
    team_list.append([name, f, int(y)])

# ---- Pro Bowl groups: S = skill (QB/RB/FB/WR/TE), D = defense, O = offensive line
GROUP = {**{p: "S" for p in ["QB", "RB", "FB", "HB", "WR", "TE", "FL", "SE"]},
         **{p: "D" for p in ["DE", "DT", "NT", "DL", "LB", "OLB", "ILB", "MLB", "CB", "S", "SS", "FS", "DB", "SAF"]},
         **{p: "O" for p in ["T", "OT", "G", "OG", "C", "OL", "LT", "RT", "LG", "RG"]}}


def norm(n):
    import unicodedata
    n = unicodedata.normalize("NFD", str(n))
    n = "".join(c for c in n if unicodedata.category(c) != "Mn").lower()
    n = re.sub(r"[^a-z0-9 ]", "", n)
    n = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    # "a j brown" -> "aj brown" so initials match either spelling
    n = re.sub(r"\b([a-z]) ([a-z])\b(?= )", r"\1\2", n)
    return n


players = []
key_info = {}
for key, g in df.sort_values("season").groupby("key", sort=False):
    pos = g.position.dropna().mode()
    pos = pos.iloc[0] if len(pos) else ""
    stints = sorted(teams[(t, y)] for t, y in zip(g.team, g.season))
    key_info[key] = dict(name=g.full_name.iloc[-1], pos=pos, stints=stints,
                         gsis=set(g.gsis_id.dropna()), n=norm(g.full_name.iloc[-1]),
                         first=int(g.season.min()), last=int(g.season.max()), pb="")

by_gsis = {gid: k for k, v in key_info.items() for gid in v["gsis"]}
by_norm = collections.defaultdict(list)
by_last = collections.defaultdict(list)
for k, v in key_info.items():
    by_norm[v["n"]].append(k)
    if v["n"]:
        by_last[v["n"].split(" ")[-1]].append(k)


def set_pb(k, pos):
    grp = GROUP.get(str(pos).split(",")[0].split("/")[0].strip().upper(), "")
    if not grp:
        return
    cur = key_info[k]["pb"]
    # a player keeps the most "offense-skill" group he ever made it at
    if not cur or "SDO".index(grp) < "SDO".index(cur):
        key_info[k]["pb"] = grp


hits = miss = 0
dp = pd.read_csv("/home/claude/draft_picks.csv", low_memory=False)
for r in dp[dp.probowls > 0].itertuples():
    k = by_gsis.get(r.gsis_id) if isinstance(r.gsis_id, str) else None
    if not k:
        cands = [c for c in by_norm.get(norm(r.pfr_player_name), [])
                 if r.season <= key_info[c]["first"] <= r.season + 3]
        k = cands[0] if len(cands) == 1 else None
    if k:
        set_pb(k, r.position); hits += 1
    else:
        miss += 1
print("draft pro bowl rows matched", hits, "unmatched", miss)

# Optional: full Pro Bowl list (Name|Position|first Pro Bowl year), e.g. from Wikipedia
import os
if os.path.exists("/home/claude/probowl_list.txt"):
    h = m = 0
    unmatched = []
    for line in open("/home/claude/probowl_list.txt"):
        parts = [x.strip() for x in line.split("|")]
        if len(parts) != 3 or not parts[2][:4].isdigit():
            continue
        name, pos, yr = parts[0], parts[1], int(parts[2][:4])
        grp = GROUP.get(pos.split(",")[0].strip().upper(), "")
        if " " in name.strip():
            cands = [c for c in by_norm.get(norm(name), [])
                     if key_info[c]["first"] - 1 <= yr <= key_info[c]["last"] + 1]
            if len(cands) > 1:  # same name: keep the one at the listed position group
                cands = [c for c in cands if GROUP.get(str(key_info[c]["pos"]).upper(), "") == grp] or cands
        else:
            # surname-only row: same last name, active that year, same side of the ball
            cands = [c for c in by_last.get(norm(name), [])
                     if key_info[c]["first"] <= yr <= key_info[c]["last"] + 1
                     and GROUP.get(str(key_info[c]["pos"]).upper(), "") == grp]
        if len(cands) == 1:
            set_pb(cands[0], pos); h += 1
        else:
            m += 1
            unmatched.append(line.strip())
    print("pro bowl list matched", h, "unmatched", m)
    open("/home/claude/probowl_unmatched.txt", "w").write("\n".join(unmatched))

for v in key_info.values():
    players.append([v["name"], v["pos"], v["stints"], v["pb"]])

players.sort(key=lambda p: (min(team_list[s][2] for s in p[2]), p[0]))
print("players", len(players), "team-seasons", len(team_list),
      "stints", sum(len(p[2]) for p in players))
json.dump({"teams": team_list, "players": players},
          open("/home/claude/nfl-teammates.json", "w"), separators=(",", ":"))
