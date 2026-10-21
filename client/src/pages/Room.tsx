import { useMemo, useState } from "react";
import ActionBar from "../components/ActionBar";
import ChatPanel from "../components/ChatPanel";
import ConnectionBadge from "../components/ConnectionBadge";
import Loading from "../components/Loading";
import StatsPanel from "../components/StatsPanel";
import VideoFrame from "../components/VideoFrame";
import VideoView from "../components/VideoView";
import { useCall } from "../hooks/useCall";
import { describeSearch } from "../lib/searchStatus";
import { readMediaSettings } from "../media/settings";
import type { MatchPrefs } from "../types/signaling";

interface RoomProps {
  prefs: MatchPrefs;
  localStream: MediaStream | null;
  onExit: () => void;
}

export default function Room({ prefs, localStream, onExit }: RoomProps) {
  const settings = useMemo(() => readMediaSettings(), []);
  const { state, controller } = useCall(prefs, localStream, settings);
  const [showStats, setShowStats] = useState(settings.showStats);

  const isVideo = prefs.mode === "video";
  const matched = state.roomId !== null;
  const searchText = describeSearch(prefs, state.searchScope);

  const badge = matched ? <ConnectionBadge state={state.connectionState} path={state.stats?.path ?? null} /> : null;
  const statsPanel = matched && showStats ? <StatsPanel stats={state.stats} /> : null;

  const chat = (
    <ChatPanel
      key={state.roomId ?? "searching"}
      entries={state.chat.entries}
      canSend={state.chat.open}
      strangerTyping={state.chat.strangerTyping}
      onSend={(text) => controller.sendMessage(text)}
      onDraftChange={(text) => controller.updateDraft(text)}
      onDraftBlur={() => controller.stopTyping()}
      className={isVideo ? "h-72" : "flex-1"}
    />
  );

  const exit = () => {
    controller.leave();
    onExit();
  };

  return (
    <>
      <main className="flex-1 flex flex-col min-h-0">
        {isVideo ? (
          <div className="max-w-6xl w-full mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
            <VideoFrame>{localStream ? <VideoView stream={localStream} muted /> : <Loading />}</VideoFrame>
            <VideoFrame>
              {state.remoteStream ? (
                <VideoView stream={state.remoteStream} />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Loading />
                  {matched ? null : <p className="text-sm text-gray-500 px-4 text-center">{searchText}</p>}
                </div>
              )}
              {badge}
              {statsPanel ? (
                <div className="absolute left-2 right-2 bottom-2 sm:right-auto sm:max-w-[26rem] max-h-[70%] overflow-y-auto">
                  {statsPanel}
                </div>
              ) : null}
            </VideoFrame>
            <div className="md:col-span-2 flex flex-col">{chat}</div>
          </div>
        ) : (
          <div className="max-w-2xl w-full mx-auto px-4 py-6 flex-1 flex flex-col min-h-[24rem] gap-2">
            <div className="relative h-7 flex items-center">
              {badge ?? <p className="text-sm text-gray-500" aria-live="polite">{searchText}</p>}
            </div>
            {statsPanel}
            {chat}
          </div>
        )}
      </main>

      <ActionBar>
        <button disabled={!matched} className="btn btn-primary" onClick={() => controller.pass()}>
          Pass
        </button>
        <button className="btn btn-ghost" onClick={() => setShowStats((v) => !v)} aria-pressed={showStats}>
          {showStats ? "Hide stats" : "Stats"}
        </button>
        <button className="btn btn-ghost" onClick={exit}>
          Exit
        </button>
      </ActionBar>
    </>
  );
}
