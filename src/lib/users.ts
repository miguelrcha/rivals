export type User = {
  username: string;
  displayName: string;
  color: string;
  avatarInitial: string;
  flag: string;
  tagline: string;
  joined: string;
  lastOnline: string;
  runs: number;
};

export const USERS: User[] = [
  {
    username: "red",
    displayName: "Red",
    color: "#f5de1b",
    avatarInitial: "R",
    flag: "🇯🇵",
    tagline: "Kanto specialist. Started the crew's rivalry.",
    joined: "2 years ago",
    lastOnline: "today",
    runs: 12,
  },
  {
    username: "blue",
    displayName: "Blue",
    color: "#3b8fc4",
    avatarInitial: "B",
    flag: "🇺🇸",
    tagline: "Fastest Crystal runner in the group.",
    joined: "2 years ago",
    lastOnline: "today",
    runs: 9,
  },
  {
    username: "green",
    displayName: "Green",
    color: "#2e9e5b",
    avatarInitial: "G",
    flag: "🇧🇷",
    tagline: "Glitchless purist. No sequence breaks, ever.",
    joined: "1 year ago",
    lastOnline: "yesterday",
    runs: 7,
  },
  {
    username: "yellow",
    displayName: "Yellow",
    color: "#e0703f",
    avatarInitial: "Y",
    flag: "🇬🇧",
    tagline: "Newest racer, already chasing WRs.",
    joined: "6 months ago",
    lastOnline: "today",
    runs: 5,
  },
];

export function getUserByUsername(username: string): User | undefined {
  return USERS.find((user) => user.username === username);
}
