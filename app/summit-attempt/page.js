import { redirect } from "next/navigation";

export const metadata = {
  title: "Summit Attempt | Daily Challenge",
  openGraph: {
    title: "Summit Attempt | Daily Challenge",
    images: [
      {
        url: "https://res.cloudinary.com/dwtaveb0v/image/upload/v1777052650/Screenshot_2026-04-24_at_1.44.04_PM_qphxbz.png"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Summit Attempt | Daily Challenge",
    images: [
      "https://res.cloudinary.com/dwtaveb0v/image/upload/v1777052650/Screenshot_2026-04-24_at_1.44.04_PM_qphxbz.png"
    ]
  }
};

export default function SummitAttemptPage() {
  redirect("/play");
}
