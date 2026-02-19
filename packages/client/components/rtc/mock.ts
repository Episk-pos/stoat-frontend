/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConnectionState, RoomEvent, Track } from "livekit-client";

/**
 * Mock Track
 */
class MockTrack {
  kind: Track.Kind;
  source: Track.Source;
  mediaStreamTrack: MediaStreamTrack;

  constructor(kind: Track.Kind, source: Track.Source) {
    this.kind = kind;
    this.source = source;

    if (kind === Track.Kind.Video) {
      // Create a dummy MediaStreamTrack using Canvas for Video
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const stream = (canvas as any).captureStream();
      this.mediaStreamTrack = stream.getVideoTracks()[0];
    } else {
      // Create a dummy MediaStreamTrack for Audio
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      this.mediaStreamTrack = dest.stream.getAudioTracks()[0];
    }
  }

  attach() {
    const el = document.createElement("video");
    el.srcObject = new MediaStream([this.mediaStreamTrack]);
    return el;
  }

  detach() {
    return [];
  }

  stop() {}
}

/**
 * Mock Track Publication
 */
class MockTrackPublication {
  kind: Track.Kind;
  source: Track.Source;
  track?: MockTrack;
  isMuted = false;
  isSubscribed = true;

  constructor(kind: Track.Kind, source: Track.Source, track?: MockTrack) {
    this.kind = kind;
    this.source = source;
    this.track = track;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setSubscribed(subscribed: boolean) {
    this.isSubscribed = subscribed;
  }
}

/**
 * Mock Participant
 */
class MockParticipant extends EventTarget {
  identity: string;
  name?: string;
  isSpeaking = false;
  trackPublications = new Map<string, MockTrackPublication>();

  constructor(identity: string, name?: string) {
    super();
    this.identity = identity;
    this.name = name;
  }

  get isMicrophoneEnabled() {
    return !this.trackPublications.get(Track.Source.Microphone)?.isMuted;
  }

  get isCameraEnabled() {
    return !!this.trackPublications.get(Track.Source.Camera);
  }

  get isScreenShareEnabled() {
    return !!this.trackPublications.get(Track.Source.ScreenShare);
  }

  getTrackPublication(source: Track.Source) {
    return Array.from(this.trackPublications.values()).find(
      (p) => p.source === source,
    );
  }
}

/**
 * Mock Local Participant
 */
class MockLocalParticipant extends MockParticipant {
  async setMicrophoneEnabled(enabled: boolean) {
    let pub = this.getTrackPublication(Track.Source.Microphone);
    if (!pub) {
      pub = new MockTrackPublication(
        Track.Kind.Audio,
        Track.Source.Microphone,
        new MockTrack(Track.Kind.Audio, Track.Source.Microphone) as any,
      );
      this.trackPublications.set(Track.Source.Microphone, pub);
    }
    pub.setMuted(!enabled);
    return pub.track;
  }

  async setCameraEnabled(enabled: boolean) {
    let pub = this.getTrackPublication(Track.Source.Camera);
    if (enabled && !pub) {
      pub = new MockTrackPublication(
        Track.Kind.Video,
        Track.Source.Camera,
        new MockTrack(Track.Kind.Video, Track.Source.Camera) as any,
      );
      this.trackPublications.set(Track.Source.Camera, pub);
    } else if (!enabled && pub) {
      this.trackPublications.delete(Track.Source.Camera);
    }
    return pub?.track;
  }

  async setScreenShareEnabled(enabled: boolean) {
    let pub = this.getTrackPublication(Track.Source.ScreenShare);
    if (enabled && !pub) {
      pub = new MockTrackPublication(
        Track.Kind.Video,
        Track.Source.ScreenShare,
        new MockTrack(Track.Kind.Video, Track.Source.ScreenShare) as any,
      );
      this.trackPublications.set(Track.Source.ScreenShare, pub);
    } else if (!enabled && pub) {
      this.trackPublications.delete(Track.Source.ScreenShare);
    }
    return pub?.track;
  }

  async unpublishTrack() {}
  async publishTrack() {}
}

/**
 * Mock Room
 */
export class MockRoom extends EventTarget {
  state = ConnectionState.Disconnected;
  localParticipant = new MockLocalParticipant("local-user", "Local User");
  remoteParticipants = new Map<string, MockParticipant>();

  constructor() {
    super();
  }

  async connect() {
    this.state = ConnectionState.Connected;
    this.dispatchEvent(new CustomEvent(RoomEvent.Connected));
  }

  disconnect() {
    this.state = ConnectionState.Disconnected;
    this.dispatchEvent(new CustomEvent(RoomEvent.Disconnected));
  }

  getParticipantByIdentity(identity: string) {
    if (identity === this.localParticipant.identity)
      return this.localParticipant;
    return this.remoteParticipants.get(identity);
  }

  // --- Test Controller Methods ---

  addRemoteParticipant(identity: string, name?: string) {
    const p = new MockParticipant(identity, name);

    // Add default camera track so UI renders tiles correctly
    const pub = new MockTrackPublication(
      Track.Kind.Video,
      Track.Source.Camera,
      new MockTrack(Track.Kind.Video, Track.Source.Camera) as any,
    );
    p.trackPublications.set(Track.Source.Camera, pub);

    this.remoteParticipants.set(identity, p);
    this.dispatchEvent(
      new CustomEvent(RoomEvent.ParticipantConnected, { detail: p }),
    );
    return p;
  }

  removeRemoteParticipant(identity: string) {
    const p = this.remoteParticipants.get(identity);
    if (p) {
      this.remoteParticipants.delete(identity);
      this.dispatchEvent(
        new CustomEvent(RoomEvent.ParticipantDisconnected, { detail: p }),
      );
    }
  }

  simulateActiveSpeakers(speakers: MockParticipant[]) {
    this.dispatchEvent(
      new CustomEvent(RoomEvent.ActiveSpeakersChanged, { detail: speakers }),
    );
  }

  // Event compatibility layer
  on(event: string, callback: (...args: any[]) => void) {
    this.addEventListener(event, (ev: any) => {
      if (ev instanceof CustomEvent) {
        callback(ev.detail);
      } else {
        callback(ev);
      }
    });
  }

  off(event: string, callback: (...args: any[]) => void) {
    this.removeEventListener(event, callback as any);
  }

  removeAllListeners() {
    // No-op for mock, but required by SDK interface
  }
}

// Global controller for E2E tests
if (typeof window !== "undefined") {
  (window as any).__STOAT_TEST_CONTROLLER__ = {
    room: null as MockRoom | null,
    addRemoteParticipant(id: string, name?: string) {
      return this.room?.addRemoteParticipant(id, name);
    },
    removeRemoteParticipant(id: string) {
      this.room?.removeRemoteParticipant(id);
    },
    simulateActiveSpeakers(ids: string[]) {
      const speakers = ids
        .map((id) => this.room?.getParticipantByIdentity(id))
        .filter(Boolean) as MockParticipant[];
      this.room?.simulateActiveSpeakers(speakers);
    },
    startScreenshare(id: string) {
      const p = this.room?.getParticipantByIdentity(id);
      if (p) {
        const pub = new MockTrackPublication(
          Track.Kind.Video,
          Track.Source.ScreenShare,
          new MockTrack(Track.Kind.Video, Track.Source.ScreenShare) as any,
        );
        p.trackPublications.set(Track.Source.ScreenShare, pub);
        this.room?.dispatchEvent(
          new CustomEvent(RoomEvent.TrackPublished, {
            detail: { publication: pub, participant: p },
          }),
        );
      }
    },
  };
}
