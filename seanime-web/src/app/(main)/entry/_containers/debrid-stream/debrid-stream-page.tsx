import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { useGetAnimeEpisodeCollection } from "@/api/hooks/anime.hooks"
import { useDeleteTorrentstreamBatchHistory, useGetTorrentstreamBatchHistory } from "@/api/hooks/torrentstream.hooks"
import { useDebridstreamAutoplay } from "@/app/(main)/_features/autoplay/autoplay"
import { useServerStatus } from "@/app/(main)/_hooks/use-server-status"
import { useHandleStartDebridStream } from "@/app/(main)/entry/_containers/debrid-stream/_lib/handle-debrid-stream"
import { ENTRY_VIEW_TRANSITION } from "@/app/(main)/entry/_containers/entry-view-transition"
import { useTorrentSearchSelectedStreamEpisode } from "@/app/(main)/entry/_containers/torrent-search/_lib/handle-torrent-selection"
import {
    __torrentSearch_selectionAtom,
    __torrentSearch_selectionEpisodeAtom,
} from "@/app/(main)/entry/_containers/torrent-search/torrent-search-drawer"
import { TorrentStreamEpisodeSection } from "@/app/(main)/entry/_containers/torrent-stream/_components/torrent-stream-episode-section"
import { ForcePlaybackMethod, useForcePlaybackMethod } from "@/app/(main)/entry/_lib/handle-play-media"
import { ConfirmationDialog, useConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { PageWrapper } from "@/components/shared/page-wrapper"
import { AppLayoutStack } from "@/components/ui/app-layout"
import { IconButton } from "@/components/ui/button"
import { Popover } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { logger } from "@/lib/helpers/debug"
import { atom } from "jotai"
import { useAtom } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import React from "react"
import { AiOutlineExclamationCircle } from "react-icons/ai"
import { BiX } from "react-icons/bi"
import { StreamPageSkeleton } from "../../_components/stream-page-skeleton"

type DebridStreamPageProps = {
    children?: React.ReactNode
    entry: Anime_Entry
    bottomSection?: React.ReactNode
}

export const __debridStream_autoSelectFileAtom = atomWithStorage("sea-debridstream-manually-select-file", false)
export const __debridStream_currentSessionAutoSelectAtom = atom<boolean | undefined>(undefined)

// DEVNOTE: This page uses some utility functions from the TorrentStream feature

export function DebridStreamPage(props: DebridStreamPageProps) {

    const {
        children,
        entry,
        bottomSection,
        ...rest
    } = props

    const serverStatus = useServerStatus()

    // State to manage auto-select setting
    const [autoSelect, setAutoSelect] = React.useState(serverStatus?.debridSettings?.streamAutoSelect ?? false)
    const [autoSelectFile, setAutoSelectFile] = useAtom(__debridStream_autoSelectFileAtom)

    // Sync the auto-select setting with the current session
    const [, setCurrentSessionAutoSelect] = useAtom(__debridStream_currentSessionAutoSelectAtom)
    React.useEffect(() => {
        setCurrentSessionAutoSelect(autoSelect)
    }, [autoSelect])

    /**
     * Get all episodes to watch
     */
    const { data: episodeCollection, isLoading } = useGetAnimeEpisodeCollection(entry.mediaId)

    React.useLayoutEffect(() => {
        // Set auto-select to the server status value
        if (!episodeCollection?.hasMappingError) {
            setAutoSelect(serverStatus?.debridSettings?.streamAutoSelect ?? false)
        } else {
            // Fall back to manual select if no download info (no Animap data)
            setAutoSelect(false)
        }
    }, [serverStatus?.debridSettings?.streamAutoSelect, episodeCollection])

    // Atoms to control the torrent search drawer state
    const [, setTorrentSearchDrawerOpen] = useAtom(__torrentSearch_selectionAtom)
    const [, setTorrentSearchEpisode] = useAtom(__torrentSearch_selectionEpisodeAtom)

    // Stores the episode that was clicked
    const { setTorrentSearchStreamEpisode } = useTorrentSearchSelectedStreamEpisode()

    // Function to handle playing the next episode on mount
    function handlePlayNextEpisodeOnMount(episode: Anime_Episode) {
        if (autoSelect) {
            handleAutoSelect(entry, episode)
        } else {
            handleEpisodeClick(episode)
        }
    }

    // Hook to handle starting the debrid stream
    const { handleAutoSelectStream, isUsingNativePlayer } = useHandleStartDebridStream()

    const { forcePlaybackMethodFn } = useForcePlaybackMethod()

    // Hook to manage debrid stream autoplay information
    const { setDebridstreamAutoplayInfo } = useDebridstreamAutoplay()
    const { mutate: deleteBatchHistory, isPending: isDeletingBatchHistory } = useDeleteTorrentstreamBatchHistory()
    const { data: batchHistory } = useGetTorrentstreamBatchHistory(entry.mediaId, true)

    const confirmPreviousBatchAction = useConfirmationDialog({
        title: "Delete previous selection?",
        description: "Remove the saved previous batch from the stream selection list.",
        actionText: "Delete history",
        cancelText: "Keep",
        onConfirm: () => deleteBatchHistory({ mediaId: entry.mediaId }),
    })
    // Function to set the debrid stream autoplay info
    // It checks if there is a next episode and if it has aniDBEpisode
    // If so, it sets the autoplay info
    // Otherwise, it resets the autoplay info
    function handleSetDebridstreamAutoplayInfo(episode: Anime_Episode | undefined) {
        if (!episode || !episode.aniDBEpisode || !episodeCollection?.episodes) return
        const nextEpisode = episodeCollection?.episodes?.find(e => e.episodeNumber === episode.episodeNumber + 1)
        logger("TORRENTSTREAM").info("Auto select, Next episode", nextEpisode)
        if (nextEpisode && !!nextEpisode.aniDBEpisode) {
            setDebridstreamAutoplayInfo({
                allEpisodes: episodeCollection?.episodes,
                entry: entry,
                episodeNumber: nextEpisode.episodeNumber,
                aniDBEpisode: nextEpisode.aniDBEpisode,
                type: "debridstream",
            })
        } else {
            setDebridstreamAutoplayInfo(null)
        }
    }

    // Function to handle auto-selecting an episode
    function handleAutoSelect(entry: Anime_Entry, episode: Anime_Episode | undefined) {
        if (!episode || !episode.aniDBEpisode || !episodeCollection?.episodes) return
        // Start the debrid stream
        handleAutoSelectStream({
            mediaId: entry.mediaId,
            episodeNumber: episode.episodeNumber,
            aniDBEpisode: episode.aniDBEpisode,
        })

        // Set the debrid stream autoplay info
        handleSetDebridstreamAutoplayInfo(episode)
    }

    // Function to handle episode click events
    const handleEpisodeClick = (episode: Anime_Episode, forcePlaybackMethod?: ForcePlaybackMethod) => {
        if (!episode || !episode.aniDBEpisode) return

        console.log("handleEpisodeClick", episode, forcePlaybackMethod)

        setTorrentSearchStreamEpisode(episode)

        if (autoSelect) {
            forcePlaybackMethodFn(forcePlaybackMethod, () => {
                handleAutoSelect(entry, episode)
            })
        } else {
            setTorrentSearchEpisode(episode.episodeNumber)
            forcePlaybackMethodFn(forcePlaybackMethod, () => {
                // The stream list is always shown when stream auto-select is off.
                setTorrentSearchDrawerOpen(autoSelectFile ? "debridstream-select" : "debridstream-select-file")
            })
        }
    }

    if (!entry.media) return null
    if (isLoading) return <StreamPageSkeleton />

    return (
        <>
            <PageWrapper
                data-anime-entry-page-debrid-stream-view
                key="debrid-streaming-episodes"
                className="relative 2xl:order-first pb-10 lg:pt-0"
                {...ENTRY_VIEW_TRANSITION}
            >
                <div className="h-10 lg:h-0" />
                <AppLayoutStack data-debrid-stream-page>
                    {/*<div className="absolute right-0 top-[-3rem]" data-debrid-stream-page-title-container>*/}
                    {/*    <h2 className="text-xl lg:text-3xl flex items-center gap-3">Debrid streaming</h2>*/}
                    {/*</div>*/}

                    <div
                        className="flex flex-col flex-wrap lg:flex-nowrap items-start md:items-center md:flex-row gap-2 md:gap-6 2xl:py-0 lg:h-12"
                        data-debrid-stream-page-content-actions-container
                    >
                        <Switch
                            label="Auto-select"
                            value={autoSelect}
                            onValueChange={v => {
                                setAutoSelect(v)
                            }}
                            // moreHelp="Automatically select the best torrent and file to stream"
                            fieldClass="w-fit flex-none"
                        />

                        {!autoSelect && (
                            <Switch
                                label="Auto-select file"
                                value={autoSelectFile}
                                onValueChange={v => {
                                    setAutoSelectFile(v)
                                }}
                                moreHelp="The episode file will be automatically selected from your chosen batch torrent"
                                fieldClass="w-fit flex-none"
                            />
                        )}

                        {!autoSelect && batchHistory?.torrent?.isBatch && (
                            <div className="relative w-full xl:max-w-[20rem] group/torrent-stream-batch-history">
                                <div className="rounded-full max-w-[20rem]">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-none items-center justify-center">
                                            <IconButton
                                                intent="alert-subtle"
                                                icon={<BiX />}
                                                size="xs"
                                                onClick={() => confirmPreviousBatchAction.open()}
                                                disabled={isDeletingBatchHistory}
                                                className="rounded-full"
                                            />
                                        </div>
                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="flex items-center flex-none gap-1">Saved previous selection
                                                <Popover
                                                    className="text-sm"
                                                    trigger={
                                                        <AiOutlineExclamationCircle className="transition-opacity opacity-45 hover:opacity-90 cursor-pointer" />}
                                                >
                                                    Available as an explicit choice in the stream list: {batchHistory.torrent?.name}
                                                </Popover>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {episodeCollection?.hasMappingError && (
                        <div data-debrid-stream-page-no-metadata-message-container>
                            <p className="text-red-200 opacity-50">
                                No metadata info available for this anime. You may need to manually select the file to stream.
                            </p>
                        </div>

                    )}

                    <TorrentStreamEpisodeSection
                        contextType="debridstream"
                        episodeCollection={episodeCollection}
                        entry={entry}
                        onEpisodeClick={handleEpisodeClick}
                        onPlayExternallyEpisodeClick={!isUsingNativePlayer ? undefined : (episode) => {
                            handleEpisodeClick(episode, "playbackmanager")
                        }}
                        onPlayNextEpisodeOnMount={handlePlayNextEpisodeOnMount}
                        bottomSection={bottomSection}
                    />
                </AppLayoutStack>
            </PageWrapper>
            <ConfirmationDialog {...confirmPreviousBatchAction} />
        </>
    )
}
