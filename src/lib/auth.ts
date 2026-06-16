import type { NextAuthOptions } from "next-auth";
import { TwitterLegacy } from "next-auth/providers/twitter";
import { getXAuthMode } from "./xAuthMode";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

function requiredEnvOneOf(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  throw new Error(`Missing required env variable: ${names.join(" or ")}`);
}

function xProfileImage(url: string | null | undefined) {
  return url?.replace(/_normal\.(jpg|jpeg|png|gif|webp)$/i, ".$1") || null;
}

function createTwitterProvider() {
  const mode = getXAuthMode();

  if (mode === "V1") {
    return TwitterLegacy({
      clientId: requiredEnvOneOf([
        "TWITTER_CONSUMER_KEY",
        "TWITTER_API_KEY",
        "X_API_KEY",
        "TWITTER_CLIENT_ID",
      ]),
      clientSecret: requiredEnvOneOf([
        "TWITTER_CONSUMER_KEY_SECRET",
        "TWITTER_CONSUMER_SECRET",
        "TWITTER_CONSUMER_KEY_SECRET",
        "TWITTER_API_SECRET",
        "X_API_SECRET",
        "TWITTER_CLIENT_SECRET",
      ]),
      profile(profile: any) {
        return {
          id: String(profile.id_str || profile.id || ""),
          name: profile.name || profile.screen_name || "X user",
          email: profile.email || null,
          image: xProfileImage(
            profile.profile_image_url_https || profile.profile_image_url,
          ),
          twitter_username: profile.screen_name || null,
        } as any;
      },
    } as any);
  }

  return {
    id: "twitter",
    name: "X",
    type: "oauth",

    clientId: requiredEnv("TWITTER_CLIENT_ID"),
    clientSecret: requiredEnv("TWITTER_CLIENT_SECRET"),

    authorization: {
      url: "https://x.com/i/oauth2/authorize",
      params: {
        scope: "users.read tweet.read",
      },
    },

    token: {
      url: "https://api.x.com/2/oauth2/token",
    },

    userinfo: {
      url: "https://api.x.com/2/users/me",
      params: {
        "user.fields": "profile_image_url",
      },
    },

    checks: ["pkce", "state"],

    client: {
      token_endpoint_auth_method: "client_secret_basic",
    },

    profile(profile: any) {
      const data = profile?.data || profile || {};

      return {
        id: String(data.id || ""),
        name: data.name || data.username || "X user",
        email: null,
        image: xProfileImage(data.profile_image_url),
        twitter_username: data.username || null,
      } as any;
    },
  } as any;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",

  secret: requiredEnv("NEXTAUTH_SECRET"),

  providers: [createTwitterProvider()],

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    async jwt({ token, profile, user, account }: any) {
      if (account?.provider === "twitter" || profile || user) {
        const data = profile?.data || profile || {};

        token.twitter_username =
          data.screen_name ||
          data.username ||
          user?.twitter_username ||
          user?.name ||
          token.twitter_username ||
          null;

        token.twitter_image =
          xProfileImage(data.profile_image_url_https || data.profile_image_url) ||
          data.profile_image_url ||
          user?.image ||
          token.twitter_image ||
          null;

        token.provider = account?.provider || token.provider || "twitter";
      }

      return token;
    },

    async session({ session, token }: any) {
      session.twitter_username = token.twitter_username || null;
      session.twitter_image = token.twitter_image || null;
      session.provider = token.provider || null;

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        const nextUrl = new URL(url);
        if (nextUrl.origin === baseUrl) return url;
      } catch {
        // ignore malformed callback URL
      }

      return baseUrl;
    },
  },

  logger: {
    error(code, metadata) {
      console.error("[next-auth][error]", code, metadata);
    },
    warn(code) {
      console.warn("[next-auth][warn]", code);
    },
    debug(code, metadata) {
      if (process.env.NEXTAUTH_DEBUG === "true") {
        console.debug("[next-auth][debug]", code, metadata);
      }
    },
  },

  session: {
    strategy: "jwt",
  },
};
