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

players = []
pid = {}
for key, g in df.sort_values("season").groupby("key", sort=False):
    pos = g.position.dropna().mode()
    pos = pos.iloc[0] if len(pos) else ""
    stints = sorted(teams[(t, y)] for t, y in zip(g.team, g.season))
    players.append([g.full_name.iloc[-1], pos, stints])

players.sort(key=lambda p: (min(team_list[s][2] for s in p[2]), p[0]))
print("players", len(players), "team-seasons", len(team_list),
      "stints", sum(len(p[2]) for p in players))
json.dump({"teams": team_list, "players": players},
          open("/home/claude/nfl-teammates.json", "w"), separators=(",", ":"))
