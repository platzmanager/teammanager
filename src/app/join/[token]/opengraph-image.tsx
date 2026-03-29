import { ImageResponse } from "next/og";
import { getTeamByInviteToken } from "@/actions/members";

export const runtime = "edge";
export const alt = "Team beitreten";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const team = await getTeamByInviteToken(token);

  if (!team) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            color: "#fff",
            fontSize: 48,
            fontFamily: "sans-serif",
          }}
        >
          Einladung nicht gefunden
        </div>
      ),
      { ...size }
    );
  }

  const club = team.club as { name: string };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1a1a1a",
          fontFamily: "sans-serif",
          padding: 0,
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 8,
            width: "100%",
            backgroundColor: "#e4653e",
            display: "flex",
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 80px",
          }}
        >
          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#e4653e",
                letterSpacing: "-0.02em",
                textTransform: "uppercase" as const,
              }}
            >
              matchday.
            </div>
          </div>

          {/* Team name */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            {team.name}
          </div>

          {/* Club name */}
          <div
            style={{
              fontSize: 36,
              color: "#a0a0a0",
              marginBottom: 48,
            }}
          >
            {club.name}
          </div>

          {/* CTA */}
          <div
            style={{
              display: "flex",
            }}
          >
            <div
              style={{
                display: "flex",
                backgroundColor: "#e4653e",
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 600,
                padding: "16px 40px",
              }}
            >
              Jetzt beitreten
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
