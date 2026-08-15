const NEWS = [
  {
    title: "Race Night #12 recap — new WR set",
    timeAgo: "2 days ago",
    snippet:
      "Red shattered the Any% record on the route everyone said was too risky. Full splits inside.",
    author: "Red",
    avatar: "R",
    comments: 5,
  },
  {
    title: "Glitchless rules updated",
    timeAgo: "1 week ago",
    snippet:
      "Clarified what counts as a sequence break after last Friday's Safari Zone debate.",
    author: "Blue",
    avatar: "B",
    comments: 3,
  },
  {
    title: "Next up: Pokémon Crystal rotation",
    timeAgo: "2 weeks ago",
    snippet:
      "Crew vote is in — Crystal Any% is the next game on the schedule starting this Friday.",
    author: "Green",
    avatar: "G",
    comments: 8,
  },
  {
    title: "Submission window closes Sunday",
    timeAgo: "3 weeks ago",
    snippet:
      "Got a run you haven't logged yet? VODs are due by Sunday night to count for the board.",
    author: "Yellow",
    avatar: "Y",
    comments: 2,
  },
];

export function CommunityNews() {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">COMMUNITY NEWS</span>
        <span className="dashboard-panel__arrow" aria-hidden="true">
          ↗
        </span>
      </div>

      <div className="news-list">
        {NEWS.map((item) => (
          <div className="news-item" key={item.title}>
            <div className="news-item__top">
              <div className="news-item__title">{item.title}</div>
              <div className="news-item__ago">{item.timeAgo}</div>
            </div>

            <p className="news-item__snippet">{item.snippet}</p>

            <div className="news-item__footer">
              <span className="news-item__avatar" aria-hidden="true">
                {item.avatar}
              </span>
              <span className="news-item__author">{item.author}</span>
              <span className="news-item__comments">💬 {item.comments}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
