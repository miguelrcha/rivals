import Image from "next/image";

export function SupporterBanner() {
  return (
    <div className="dashboard-banner">
      <div className="dashboard-banner__photo">
        <Image
          src="/banners/supporter-banner.png"
          alt="Sponsor banner"
          fill
          sizes="260px"
          className="dashboard-banner__photo-img"
        />
      </div>

      <div className="dashboard-banner__content">
        <p className="dashboard-banner__text">
          Supporters help keep race night running.
        </p>
        <button className="dashboard-banner__cta" type="button">
          Join for $3.99/month
        </button>
      </div>
    </div>
  );
}
