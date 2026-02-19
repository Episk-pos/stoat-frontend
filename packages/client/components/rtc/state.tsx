/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Accessor,
  JSX,
  Setter,
  batch,
  createContext,
  createSignal,
  useContext,
} from "solid-js";
import { RoomContext } from "solid-livekit-components";

import {
  type FacingMode,
  Room,
  Track,
  createLocalVideoTrack,
  facingModeFromLocalTrack,
} from "livekit-client";
import { Channel } from "stoat.js";

import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Voice as VoiceSettings } from "@revolt/state/stores/Voice";
import { VoiceCallCardContext } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { InRoom } from "./components/InRoom";
import { RoomAudioManager } from "./components/RoomAudioManager";
import { MockRoom } from "./mock";

type State =
  | "READY"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

class Voice {
  #settings: VoiceSettings;

  channel: Accessor<Channel | undefined>;
  #setChannel: Setter<Channel | undefined>;

  room: Accessor<Room | undefined>;
  #setRoom: Setter<Room | undefined>;

  state: Accessor<State>;
  #setState: Setter<State>;

  deafen: Accessor<boolean>;
  #setDeafen: Setter<boolean>;

  microphone: Accessor<boolean>;
  #setMicrophone: Setter<boolean>;

  video: Accessor<boolean>;
  #setVideo: Setter<boolean>;

  screenshare: Accessor<boolean>;
  #setScreenshare: Setter<boolean>;

  audioOnly: Accessor<boolean>;
  #setAudioOnly: Setter<boolean>;

  spotlightHideMembers: Accessor<boolean>;
  #setSpotlightHideMembers: Setter<boolean>;

  /** Per-remote-user camera watch override (session-scoped). */
  videoWatchDisabled: Accessor<Record<string, boolean>>;
  #setVideoWatchDisabled: Setter<Record<string, boolean>>;

  /** Per-remote-user screenshare watch state (session-scoped). */
  screenshareWatch: Accessor<Record<string, boolean>>;
  #setScreenshareWatch: Setter<Record<string, boolean>>;

  onError: (error: unknown) => void = () => {};

  constructor(voiceSettings: VoiceSettings) {
    this.#settings = voiceSettings;

    const [channel, setChannel] = createSignal<Channel>();
    this.channel = channel;
    this.#setChannel = setChannel;

    const [room, setRoom] = createSignal<Room>();
    this.room = room;
    this.#setRoom = setRoom;

    const [state, setState] = createSignal<State>("READY");
    this.state = state;
    this.#setState = setState;

    const [deafen, setDeafen] = createSignal<boolean>(false);
    this.deafen = deafen;
    this.#setDeafen = setDeafen;

    const [microphone, setMicrophone] = createSignal(false);
    this.microphone = microphone;
    this.#setMicrophone = setMicrophone;

    const [video, setVideo] = createSignal(false);
    this.video = video;
    this.#setVideo = setVideo;

    const [screenshare, setScreenshare] = createSignal(false);
    this.screenshare = screenshare;
    this.#setScreenshare = setScreenshare;

    const [audioOnly, setAudioOnly] = createSignal(false);
    this.audioOnly = audioOnly;
    this.#setAudioOnly = setAudioOnly;

    const [spotlightHideMembers, setSpotlightHideMembers] = createSignal(false);
    this.spotlightHideMembers = spotlightHideMembers;
    this.#setSpotlightHideMembers = setSpotlightHideMembers;

    const [videoWatchDisabled, setVideoWatchDisabled] = createSignal<
      Record<string, boolean>
    >({});
    this.videoWatchDisabled = videoWatchDisabled;
    this.#setVideoWatchDisabled = setVideoWatchDisabled;

    const [screenshareWatch, setScreenshareWatch] = createSignal<
      Record<string, boolean>
    >({});
    this.screenshareWatch = screenshareWatch;
    this.#setScreenshareWatch = setScreenshareWatch;
  }

  async connect(channel: Channel, auth?: { url: string; token: string }) {
    this.disconnect();

    const isMock = import.meta.env.VITE_MOCK_RTC === "true";

    const room = isMock
      ? (new MockRoom() as unknown as Room)
      : new Room({
          audioCaptureDefaults: {
            deviceId: this.#settings.preferredAudioInputDevice,
            echoCancellation: this.#settings.echoCancellation,
            noiseSuppression: this.#settings.noiseSupression,
          },
          videoCaptureDefaults: {
            deviceId: this.#settings.preferredVideoInputDevice,
          },
          audioOutput: {
            deviceId: this.#settings.preferredAudioOutputDevice,
          },
        });

    if (isMock && typeof window !== "undefined") {
      (window as any).__STOAT_TEST_CONTROLLER__.room = room;
    }

    batch(() => {
      this.#setRoom(room);
      this.#setChannel(channel);
      this.#setState("CONNECTING");

      this.#setMicrophone(false);
      this.#setDeafen(false);
      this.#setVideo(false);
      this.#setScreenshare(false);
      this.#setAudioOnly(false);
      this.#setSpotlightHideMembers(false);
      this.#setVideoWatchDisabled({});
      this.#setScreenshareWatch({});

      if (this.speakingPermission && !isMock)
        room.localParticipant
          .setMicrophoneEnabled(true)
          .then((track) => this.#setMicrophone(typeof track !== "undefined"));

      if (isMock) {
        // Instant mock connection
        setTimeout(() => {
          this.#setState("CONNECTED");
          if (this.speakingPermission) {
            void room.localParticipant.setMicrophoneEnabled(true).then(() => {
              this.#setMicrophone(true);
            });
          }
        }, 10);
      }
    });

    if (!isMock) {
      room.addListener("connected", () => this.#setState("CONNECTED"));
      room.addListener("disconnected", () => this.#setState("DISCONNECTED"));

      if (!auth) {
        auth = await channel.joinCall("worldwide");
      }

      await room.connect(auth.url, auth.token, {
        autoSubscribe: false,
      });
    }
  }

  disconnect() {
    const room = this.room();
    if (!room) return;

    room.removeAllListeners();
    room.disconnect();

    batch(() => {
      this.#setState("READY");
      this.#setRoom(undefined);
      this.#setChannel(undefined);
    });
  }

  async toggleDeafen() {
    this.#setDeafen((s) => !s);
  }

  async toggleMute() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setMicrophoneEnabled(
        !room.localParticipant.isMicrophoneEnabled,
      );

      this.#setMicrophone(room.localParticipant.isMicrophoneEnabled);
    } catch (error) {
      this.onError(error);
    }
  }

  async toggleCamera() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setCameraEnabled(
        !room.localParticipant.isCameraEnabled,
      );

      this.#setVideo(room.localParticipant.isCameraEnabled);
    } catch (error) {
      this.onError(error);
    }
  }

  async flipCamera() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";

      const camPub = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      const currentTrack = camPub?.track;

      // Determine current facing mode and flip it
      let newFacingMode: FacingMode = "environment";
      if (currentTrack) {
        const current = facingModeFromLocalTrack(currentTrack);
        newFacingMode =
          current?.facingMode === "environment" ? "user" : "environment";
      }

      // Create new track with flipped facing mode
      const newTrack = await createLocalVideoTrack({
        facingMode: newFacingMode,
      });

      // Unpublish old and publish new
      if (camPub) {
        await room.localParticipant.unpublishTrack(camPub.track!);
      }
      await room.localParticipant.publishTrack(newTrack);
      this.#setVideo(true);
    } catch (error) {
      this.onError(error);
    }
  }

  async toggleAudioOnly() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";

      const newValue = !this.audioOnly();
      this.#setAudioOnly(newValue);

      // Subscribe/unsubscribe to all remote video tracks.
      // Note: respect session-scoped watch preferences for cameras and screenshares.
      for (const participant of room.remoteParticipants.values()) {
        const userId = participant.identity;
        const videoDisabled = !!this.videoWatchDisabled()[userId];
        const screenshareWatching = !!this.screenshareWatch()[userId];

        for (const pub of participant.trackPublications.values()) {
          if (
            pub.kind === Track.Kind.Video &&
            pub.source !== Track.Source.ScreenShareAudio
          ) {
            const shouldSubscribe =
              !newValue &&
              (pub.source === Track.Source.ScreenShare
                ? screenshareWatching
                : !videoDisabled);

            pub.setSubscribed(shouldSubscribe);
          }
        }
      }
    } catch (error) {
      this.onError(error);
    }
  }

  async toggleSpotlightHideMembers() {
    this.#setSpotlightHideMembers((v) => !v);
  }

  async toggleScreenshare() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setScreenShareEnabled(
        !room.localParticipant.isScreenShareEnabled,
        { audio: true },
      );

      this.#setScreenshare(room.localParticipant.isScreenShareEnabled);
    } catch (error) {
      this.onError(error);
    }
  }

  #setRemoteSubscribed(
    userId: string,
    source: Track.Source,
    subscribed: boolean,
  ) {
    const room = this.room();
    const participant = room?.getParticipantByIdentity(userId);
    const pub = participant?.getTrackPublication(source);
    if (pub) pub.setSubscribed(subscribed);
  }

  isVideoWatchDisabled(userId: string) {
    return !!this.videoWatchDisabled()[userId];
  }

  setVideoWatchDisabled(userId: string, disabled: boolean) {
    this.#setVideoWatchDisabled((current) => ({
      ...current,
      [userId]: disabled,
    }));

    // Only subscribe when not in audio-only.
    this.#setRemoteSubscribed(
      userId,
      Track.Source.Camera,
      !disabled && !this.audioOnly(),
    );
  }

  isScreenshareWatching(userId: string) {
    return !!this.screenshareWatch()[userId];
  }

  setScreenshareWatching(userId: string, watching: boolean) {
    this.#setScreenshareWatch((current) => ({
      ...current,
      [userId]: watching,
    }));

    // Only subscribe when not in audio-only.
    this.#setRemoteSubscribed(
      userId,
      Track.Source.ScreenShare,
      watching && !this.audioOnly(),
    );
  }

  getConnectedUser(userId: string) {
    return this.room()?.getParticipantByIdentity(userId);
  }

  get listenPermission() {
    return !!this.channel()?.havePermission("Listen");
  }

  get speakingPermission() {
    return !!this.channel()?.havePermission("Speak");
  }
}

const voiceContext = createContext<Voice>(null as unknown as Voice);

/**
 * Mount global voice context and room audio manager
 */
export function VoiceContext(props: { children: JSX.Element }) {
  const state = useState();
  const { showError } = useModals();
  const voice = new Voice(state.voice);
  voice.onError = showError;

  return (
    <voiceContext.Provider value={voice}>
      <RoomContext.Provider value={voice.room}>
        <VoiceCallCardContext>{props.children}</VoiceCallCardContext>
        <InRoom>
          <RoomAudioManager />
        </InRoom>
      </RoomContext.Provider>
    </voiceContext.Provider>
  );
}

export const useVoice = () => useContext(voiceContext);
