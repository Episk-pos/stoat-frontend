import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { styled } from "styled-system/jsx";

import { useApi, useClient, useClientLifecycle } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  Button,
  CircularProgress,
  Column,
  Row,
  Text,
  TextField,
} from "@revolt/ui";

import { FlowTitle } from "./Flow";

/**
 * Response from GET /oauth2/authorize - app details
 */
interface OAuth2AppInfo {
  name: string;
  client_id: string;
  redirect_uris: string[];
  allowed_scopes: string[];
}

/**
 * Response from POST /oauth2/authorize - redirect after consent
 */
interface OAuth2ConsentResponse {
  redirect_uri: string;
}

/**
 * Scope display names for user-friendly presentation
 */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "user:read": "View your profile information",
  "channels:read": "View channels you have access to",
  "messages:read": "Read messages in your channels",
  "messages:write": "Send messages on your behalf",
  "servers:read": "View servers you are a member of",
};

/**
 * Get a human-readable description for a scope
 */
function scopeDescription(scope: string): string {
  return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

/**
 * Extract OAuth2 query parameters from the current URL
 */
function getOAuth2Params(): {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  response_type: string;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    client_id: params.get("client_id") ?? "",
    redirect_uri: params.get("redirect_uri") ?? "",
    scope: params.get("scope") ?? "",
    state: params.get("state") ?? "",
    code_challenge: params.get("code_challenge") ?? "",
    code_challenge_method: params.get("code_challenge_method") ?? "S256",
    response_type: params.get("response_type") ?? "code",
  };
}

/**
 * OAuth2 authorization / consent page.
 *
 * Handles the full flow:
 * 1. Fetch app details from backend
 * 2. If user not logged in, show login form
 * 3. Show consent screen with app name and requested scopes
 * 4. POST consent decision to backend
 * 5. Redirect user back to the third-party app
 */
export default function FlowOAuth2Authorize() {
  const state = useState();
  const { lifecycle, isLoggedIn, login } = useClientLifecycle();
  const getClient = useClient();
  const modals = useModals();
  const err = useError();

  const oauthParams = getOAuth2Params();
  const [error, setError] = createSignal<string | undefined>();
  const [submitting, setSubmitting] = createSignal(false);

  // Validate required parameters
  const missingParams = () => {
    const missing: string[] = [];
    if (!oauthParams.client_id) missing.push("client_id");
    if (!oauthParams.redirect_uri) missing.push("redirect_uri");
    if (!oauthParams.code_challenge) missing.push("code_challenge");
    return missing;
  };

  // Fetch app details from backend
  const [appInfo] = createResource(async () => {
    if (missingParams().length > 0) return undefined;

    const queryString = new URLSearchParams({
      response_type: oauthParams.response_type,
      client_id: oauthParams.client_id,
      redirect_uri: oauthParams.redirect_uri,
      scope: oauthParams.scope,
      code_challenge: oauthParams.code_challenge,
      code_challenge_method: oauthParams.code_challenge_method,
    }).toString();

    const response = await fetch(
      `${CONFIGURATION.DEFAULT_API_URL}/oauth2/authorize?${queryString}`,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch app details: ${body}`);
    }

    const data: OAuth2AppInfo = await response.json();

    // Security: validate that the requested redirect_uri is in the app's allowed list
    if (!data.redirect_uris.includes(oauthParams.redirect_uri)) {
      throw new Error(
        "The requested redirect URI is not registered for this application.",
      );
    }

    return data;
  });

  /**
   * Handle login form submission
   */
  async function handleLogin(event: Event) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await login({ email, password }, modals);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Submit consent decision to backend
   */
  async function submitConsent(consent: boolean) {
    setSubmitting(true);
    setError(undefined);

    try {
      const session = state.auth.getSession();
      if (!session) {
        setError("No active session. Please log in first.");
        setSubmitting(false);
        return;
      }

      const response = await fetch(
        `${CONFIGURATION.DEFAULT_API_URL}/oauth2/authorize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": session.token,
          },
          body: JSON.stringify({
            consent,
            client_id: oauthParams.client_id,
            redirect_uri: oauthParams.redirect_uri,
            scope: oauthParams.scope,
            state: oauthParams.state,
            code_challenge: oauthParams.code_challenge,
            code_challenge_method: oauthParams.code_challenge_method,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Authorization failed: ${body}`);
      }

      const data: OAuth2ConsentResponse = await response.json();

      // Redirect user back to the third-party application
      window.location.href = data.redirect_uri;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const requestedScopes = () =>
    oauthParams.scope.split(" ").filter((s) => s.length > 0);

  return (
    <Switch
      fallback={
        <Column gap="lg">
          <CircularProgress />
        </Column>
      }
    >
      {/* Missing required parameters */}
      <Match when={missingParams().length > 0}>
        <FlowTitle>Authorization Error</FlowTitle>
        <Text class="label">
          Missing required parameters: {missingParams().join(", ")}
        </Text>
      </Match>

      {/* Error fetching app info */}
      <Match when={appInfo.error}>
        <FlowTitle>Authorization Error</FlowTitle>
        <Text class="label">
          {appInfo.error instanceof Error
            ? appInfo.error.message
            : "Failed to load application details."}
        </Text>
      </Match>

      {/* App info loaded, but user not logged in - show login */}
      <Match when={appInfo() && !isLoggedIn()}>
        <FlowTitle subtitle="Sign in to continue" emoji="wave">
          Authorize {appInfo()!.name}
        </FlowTitle>
        <AppBadge>
          <Text class="label" size="small">
            <strong>{appInfo()!.name}</strong> wants to access your account
          </Text>
        </AppBadge>
        <form onSubmit={handleLogin}>
          <Column gap="lg">
            <TextField
              required
              type="email"
              name="email"
              label="Email"
              placeholder="Please enter your email."
              autocomplete="email"
            />
            <TextField
              required
              type="password"
              name="password"
              label="Password"
              placeholder="Enter your password."
              minLength={8}
            />
            <Show when={error()}>
              <ErrorText>{error()}</ErrorText>
            </Show>
            <Row align justify>
              <Button
                variant="text"
                onPress={() => submitConsent(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Sign In</Button>
            </Row>
          </Column>
        </form>
      </Match>

      {/* App info loaded and user logged in - show consent screen */}
      <Match when={appInfo() && isLoggedIn()}>
        <FlowTitle>Authorize {appInfo()!.name}</FlowTitle>
        <AppBadge>
          <Text class="label">
            <strong>{appInfo()!.name}</strong> is requesting access to your
            account
          </Text>
        </AppBadge>

        <Show when={requestedScopes().length > 0}>
          <Column gap="sm">
            <Text class="label" size="small">
              This application will be able to:
            </Text>
            <ScopeList>
              <For each={requestedScopes()}>
                {(scope) => (
                  <ScopeItem>
                    <ScopeBullet />
                    <Text class="label" size="small">
                      {scopeDescription(scope)}
                    </Text>
                  </ScopeItem>
                )}
              </For>
            </ScopeList>
          </Column>
        </Show>

        <Show when={error()}>
          <ErrorText>{error()}</ErrorText>
        </Show>

        <Row align justify>
          <Button
            variant="text"
            onPress={() => submitConsent(false)}
            disabled={submitting()}
          >
            Deny
          </Button>
          <Button
            onPress={() => submitConsent(true)}
            disabled={submitting()}
          >
            {submitting() ? "Authorizing..." : "Authorize"}
          </Button>
        </Row>
      </Match>
    </Switch>
  );
}

/**
 * Visual badge showing the requesting application
 */
const AppBadge = styled("div", {
  base: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "var(--md-sys-color-surface-container-high)",
  },
});

/**
 * List of requested scopes
 */
const ScopeList = styled("ul", {
  base: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

/**
 * Individual scope item
 */
const ScopeItem = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingLeft: "8px",
  },
});

/**
 * Scope bullet point
 */
const ScopeBullet = styled("div", {
  base: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--md-sys-color-primary)",
    flexShrink: 0,
  },
});

/**
 * Error text display
 */
const ErrorText = styled("div", {
  base: {
    color: "var(--md-sys-color-error)",
    fontSize: "0.85em",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "var(--md-sys-color-error-container)",
  },
});
