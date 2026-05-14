import type { NextAuthOptions } from "next-auth";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",

  secret: requiredEnv("NEXTAUTH_SECRET"),

  providers: [
    {
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
          image: data.profile_image_url || null,
          twitter_username: data.username || null,
        } as any;
      },
    } as any,
  ],

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    async jwt({ token, profile, user, account }: any) {
      if (account?.provider === "twitter" || profile || user) {
        const data = profile?.data || profile || {};

        token.twitter_username =
          data.username ||
          user?.twitter_username ||
          user?.name ||
          token.twitter_username ||
          null;

        token.twitter_image =
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