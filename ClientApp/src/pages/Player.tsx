import { SyntheticEvent, useEffect } from 'react';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Clip from '../components/Clip';
import { secondsToHHMMSS } from '../helpers/utils';

type PlayerParams = {
  game: string;
  video: string;
};

const ZOOMS = [100, 110, 125, 150, 175, 200, 250, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];

export default function Player () {
  let { game, video } = useParams<PlayerParams>();
  const videoElement = useRef<HTMLVideoElement>(null);
  const volumeSliderElement = useRef<HTMLInputElement>(null);
  const timelineElement = useRef<HTMLDivElement>(null);
  const seekWindowElement = useRef<HTMLDivElement>(null);
  const seekBarElement = useRef<HTMLDivElement>(null);
  const targetSeekElement = useRef<HTMLDivElement>(null);
  
  var seekDragging = false, clipDragging = -1, clipDragOffset = 0, clipResizeDir = '', clipResizeLimit = 0;
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentZoom, setZoom] = useState(0);
  const [currentPlaybackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const clipsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    document.addEventListener('keydown', handleOnKeyDown);
    document.addEventListener('mousedown', handleOnMouseDown);
    document.addEventListener('mousemove', handleOnMouseMove);
    document.addEventListener('mouseup', handleOnMouseUp);
    return () => {
      document.removeEventListener('keydown', handleOnKeyDown);
      document.removeEventListener('mousedown', handleOnMouseDown);
      document.removeEventListener('mousemove', handleOnMouseMove);
      document.removeEventListener('mouseup', handleOnMouseUp);
    }
  }, [clips]);

  useEffect(() => {
    scrollToSeek();
  }, [currentZoom]);

  function scrollToSeek() {
    seekBarElement.current!.style.left = `calc(${currentTime / videoElement.current!.duration * 100}% - 3px)`;
    targetSeekElement.current!.style.left = seekBarElement.current!.offsetLeft+6 + 'px';
    targetSeekElement.current!.scrollIntoView({
      behavior: 'auto',
      block: 'center',
      inline: 'center'
    });
    timelineElement.current!.scrollTop = 0;
  }

  function handleOnKeyDown(e: KeyboardEvent) {
    if(e.key === ' ') videoElement.current?.paused ? videoElement.current?.play() : videoElement.current?.pause();
    if(e.key === 'ArrowLeft') videoElement.current!.currentTime -= 5;
    if(e.key === 'ArrowRight') videoElement.current!.currentTime += 5;
  }

  function handleOnMouseDown(e: MouseEvent) {
    let element = e.target as HTMLDivElement;
  
    // seeker handling
    if(element === seekBarElement.current) {
      seekDragging = true;
    }
    else if(seekWindowElement.current?.contains(element)) {
      if (e.detail === 1) {
        if(element === seekWindowElement.current)
          mouseSeek(e);
      } else if (e.detail === 2) {
        mouseSeek(e);
      }
    }

    // clips handling
    if(clipsRef.current?.indexOf(element.parentElement as HTMLDivElement) != -1) { // clip reposition
      let index = clipsRef.current?.indexOf(element.parentElement as HTMLDivElement);
      clipDragging = index;
      clipDragOffset = e.clientX - clipsRef.current[clipDragging]?.getBoundingClientRect().left;
    } else { // clip resizing
      let index = clipsRef.current?.indexOf((element.parentElement)?.parentElement as HTMLDivElement);
      clipDragging = index;
      clipResizeDir = (element.parentElement)?.getAttribute('data-side')!;
      clipResizeLimit = clipsRef.current[clipDragging]?.clientWidth + clipsRef.current[clipDragging]?.offsetLeft;
    }
  }

  function handleOnMouseMove(e: MouseEvent) {
    if(seekDragging) {
      mouseSeek(e);
    }
    if(clipDragging !== -1 && clipResizeDir === '') {
      let clickLeft = (e.clientX - clipDragOffset + timelineElement.current!.scrollLeft - seekWindowElement.current!.offsetLeft);
      if(clickLeft < 0) clickLeft = 0;
      else if(clickLeft > seekWindowElement.current!.clientWidth - clipsRef.current[clipDragging].getBoundingClientRect().width) 
        clickLeft = seekWindowElement.current!.clientWidth - clipsRef.current[clipDragging].getBoundingClientRect().width;
      clipsRef.current[clipDragging].style.left = `${clickLeft / seekWindowElement.current!.clientWidth * 100}%`;
    }
    else if (clipDragging !== -1 && clipResizeDir !== '') {
      console.log('resizing!', clipResizeDir);
      if(clipResizeDir === 'right') {
        let clickLeft = (e.clientX - clipsRef.current[clipDragging]?.offsetLeft + timelineElement.current!.scrollLeft - seekWindowElement.current!.offsetLeft);
        if(clickLeft > seekWindowElement.current!.offsetWidth) clickLeft = seekWindowElement.current!.offsetWidth;
        clipsRef.current[clipDragging].style.width = `${clickLeft / seekWindowElement.current!.clientWidth * 100}%`;
      }
      else if(clipResizeDir === 'left') {
        let clickLeft = (e.clientX + timelineElement.current!.scrollLeft - seekWindowElement.current!.offsetLeft);
        if(clickLeft < 0) clickLeft = 0;
        if(clickLeft > clipResizeLimit) return;
        clipsRef.current[clipDragging].style.width = `${(clipsRef.current[clipDragging].offsetWidth + (clipsRef.current[clipDragging].offsetLeft - clickLeft)) / seekWindowElement.current!.clientWidth * 100}%`;
        clipsRef.current[clipDragging].style.left = `${clickLeft / seekWindowElement.current!.clientWidth * 100}%`;
      }
    }
  }

  function handleOnMouseUp(e: MouseEvent) {
    seekDragging = false;
    clipResizeDir = '';
    if(clipDragging !== -1) {
      let clipsCopy = [...clips];
      clipsCopy[clipDragging].start = clipsRef.current[clipDragging].offsetLeft / seekWindowElement.current!.clientWidth * 100;
      clipsCopy[clipDragging].duration = clipsRef.current[clipDragging].offsetWidth / seekWindowElement.current!.clientWidth * 100;
      setClips(clipsCopy);
      clipDragging = -1;
    }
  }

  function handleAddClip() {
    if(seekWindowElement.current && seekBarElement.current) {
      let start = seekBarElement.current.offsetLeft / seekWindowElement.current.clientWidth * 100;

      console.log('add');
      let newClips = clips.slice();
      if(videoElement.current)
        newClips.push({id: Date.now(), start: start, duration: 10 / videoElement.current.duration * 100}); // 10 seconds
      setClips(newClips);
    }
  }

  function handleVideoLoad(e: SyntheticEvent) {
    console.log((e));
    if(videoElement.current && volumeSliderElement.current) {
      videoElement.current.volume = parseInt(volumeSliderElement.current.value) / 100;
    }
  }

  function handleVideoPlaying(e: SyntheticEvent) {
    const videoElement = (e.target as HTMLVideoElement);
    setCurrentTime(videoElement.currentTime);
    seekBarElement.current!.style.left = `calc(${videoElement.currentTime / videoElement.duration * 100}% - 3px)`;
    targetSeekElement.current!.style.left = seekBarElement.current!.offsetLeft+6 + 'px';
  }

  function mouseSeek(e: MouseEvent) {
    let clickLeft = (e.clientX + timelineElement.current!.scrollLeft - seekWindowElement.current!.offsetLeft);
    if(clickLeft < 0) clickLeft = 0;
    else if(clickLeft > seekWindowElement.current!.clientWidth) clickLeft = seekWindowElement.current!.clientWidth;
    videoElement.current!.currentTime = (clickLeft / seekWindowElement.current!.clientWidth) * videoElement.current!.duration;
    seekBarElement.current!.style.left = `${clickLeft - 3}px`;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="relative flex w-full h-full bg-black justify-center cursor-pointer" 
        onClick={() => {
          (videoElement.current?.paused ? videoElement.current?.play() : videoElement.current?.pause())
        }}>
        <video ref={videoElement} className="absolute h-full" src={`${window.location.protocol}//${window.location.host}/Plays/${game}/${video}`} 
          onLoadedMetadata={handleVideoLoad} 
          onTimeUpdate={handleVideoPlaying}/>
      </div>

      <div className="flex flex-initial h-20 grid grid-flow-row">
        <div ref={timelineElement} className="w-full h-full overflow-x-scroll overflow-y-hidden bg-gray-400"> 
          <div style={{ height: '1rem', width: `calc(${ZOOMS[currentZoom]}% - 12px)` }} className="inline-block mx-1.5 grid grid-flow-col bg-gray-400 border-gray-300 border-l-2">
            <div className="border-gray-300 border-r-2"></div>
            <div className="border-gray-300 border-r-2"></div>
            <div className="border-gray-300 border-r-2"></div>
            <div className="border-gray-300 border-r-2"></div>
            <div className="border-gray-300 border-r-2"></div>
            <div className="border-gray-300 border-r-2"></div>
          </div>
          <div ref={seekWindowElement} style={{ height: 'calc(100% - 1rem)', width: `calc(${ZOOMS[currentZoom]}% - 12px)` }} className="inline-block mx-1.5 relative bg-gray-300">
            <div ref={seekBarElement} style={{ width: '6px', left: '-3px'}} className="z-30 absolute bg-red-500 rounded-lg h-full cursor-ew-resize"/>
            {clips && clips.map((clip, i) => {
              return <Clip key={clip.id} ref={e => clipsRef.current[i] = e!} id={clip.id} start={clip.start} duration={clip.duration}/>
            })}
          </div>
          <div ref={targetSeekElement} style={{ height: 'calc(100% - 1rem)', width: '6px', left: '3px'}} className="relative bg-green-500 rounded-lg h-full cursor-ew-resize"/>
        </div> 
      </div>

      <div className="flex flex-initial grid grid-flow-col">
        <div className="flex justify-start">
          <div className="border-2 rounded-lg">
            <button title={`${(videoElement.current?.paused ? 'Play' : 'Pause')}`} className="justify-center w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800" 
              type="button" onClick={() => {
                (videoElement.current?.paused ? videoElement.current?.play() : videoElement.current?.pause())
              }}>
                { videoElement.current?.paused ? 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                </svg> : 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                  <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                </svg>}
            </button>
            <button title="Rewind 5 Seconds" className="justify-center w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800" 
              type="button" onClick={() => videoElement.current!.currentTime -= 5}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
              </svg>
            </button>
            <div className="relative z-40 inline-block text-left dropdown">
              <button title="Playback Speed" className="-mt-0.5 mb-0.5 inline-block align-middle w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800" 
              type="button" aria-haspopup="true" aria-expanded="true" aria-controls="headlessui-menu-items-117">
                {(currentPlaybackRate + '').replace(/^0+/, '')}x
              </button>
              <div className="absolute -top-1/3 opacity-0 invisible dropdown-menu transition-all duration-300 transform">
                <div className="absolute transform -translate-y-full left-0 w-auto origin-top-left bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg outline-none" aria-labelledby="headlessui-menu-button-1" id="headlessui-menu-items-117" role="menu">
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left" 
                  onClick={() => {videoElement.current!.playbackRate = 0.25; setPlaybackRate(videoElement.current!.playbackRate);}}>.25x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 0.5; setPlaybackRate(videoElement.current!.playbackRate);}}>.5x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 0.75; setPlaybackRate(videoElement.current!.playbackRate);}}>.75x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 1; setPlaybackRate(videoElement.current!.playbackRate);}}>1x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 1.5; setPlaybackRate(videoElement.current!.playbackRate);}}>1.5x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 2; setPlaybackRate(videoElement.current!.playbackRate);}}>2x</div>
                  <div className="cursor-pointer text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left"
                  onClick={() => {videoElement.current!.playbackRate = 4; setPlaybackRate(videoElement.current!.playbackRate);}}>4x</div>
                </div>
              </div>
            </div>
            <div className="relative z-40 inline-block text-left dropdown">
              <button title="Volume" className="-mt-0.5 mb-0.5 inline-block align-middle w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800" 
              type="button" aria-haspopup="true" aria-expanded="true" aria-controls="headlessui-menu-items-117">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                  <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                  <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                  <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                </svg>
              </button>
              <div className="absolute -top-1/3 opacity-0 invisible dropdown-menu transition-all duration-300 transform">
                <div className="absolute transform -translate-y-full left-0 w-auto origin-top-left bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg outline-none" aria-labelledby="headlessui-menu-button-1" id="headlessui-menu-items-117" role="menu">
                  <div className="text-gray-700 flex justify-between w-full px-4 py-2 text-sm leading-5 text-left" role="menuitem">
                    <input ref={volumeSliderElement} type="range" min="1" max="100" step="1" 
                    onChange={(e) => {
                      if(videoElement.current) {
                        console.log(videoElement.current.volume);
                        videoElement.current.volume = parseInt((e.target as HTMLInputElement).value) / 100;
                      }
                    }}/>
                  </div>
                </div>
              </div>
            </div>
            <span className="-mt-0.5 mb-0.5 inline-block align-middle w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800">
              {`${secondsToHHMMSS(currentTime)} / ${secondsToHHMMSS(videoElement.current?.duration || 0)}`}
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          {clips.length > 0 && <div className="border-2 rounded-lg">
            <span title={`Play Clip${clips.length > 1 ? 's' : ''}`} className="cursor-pointer -mt-0.5 mb-0.5 inline-block align-middle w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="-mt-0.5 align-center mr-2 inline" viewBox="0 0 16 16">
                <path d="M2 3a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 0-1h-11A.5.5 0 0 0 2 3zm2-2a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7A.5.5 0 0 0 4 1zm2.765 5.576A.5.5 0 0 0 6 7v5a.5.5 0 0 0 .765.424l4-2.5a.5.5 0 0 0 0-.848l-4-2.5z"/>
                <path d="M1.5 14.5A1.5 1.5 0 0 1 0 13V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 16 6v7a1.5 1.5 0 0 1-1.5 1.5h-13zm13-1a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5h-13A.5.5 0 0 0 1 6v7a.5.5 0 0 0 .5.5h13z"/>
              </svg>
              {clips.length} Clip{clips.length > 1 && 's'}: {secondsToHHMMSS(clips.map(clip => clip.duration / 100 * videoElement.current!.duration).reduce((prev, next) => prev + next))}
            </span>
            <button title={`Save Clip${clips.length > 1 ? 's' : ''}`} className="justify-center w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800" 
              type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .354.854l-2.5 2.5a.5.5 0 0 1-.708 0l-2.5-2.5A.5.5 0 0 1 5.5 6.5h2V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
              </svg>
            </button>
          </div>}
        </div>

        <div className="flex justify-end">
          <div className="border-2 rounded-lg">
            <button title="Clip" className="justify-center w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-50 active:text-gray-800" 
              type="button" onClick={() => handleAddClip()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="align-bottom inline" viewBox="0 0 16 16">
                  <path d="M3.5 3.5c-.614-.884-.074-1.962.858-2.5L8 7.226 11.642 1c.932.538 1.472 1.616.858 2.5L8.81 8.61l1.556 2.661a2.5 2.5 0 1 1-.794.637L8 9.73l-1.572 2.177a2.5 2.5 0 1 1-.794-.637L7.19 8.61 3.5 3.5zm2.5 10a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0zm7 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z"/>
                </svg>
            </button>
            <span title="Zoom Out" className="text-center cursor-pointer -mt-0.5 mb-0.5 inline-block align-middle w-12 h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800"
              onClick={() => (currentZoom-1 > -1 ? setZoom(currentZoom-1) : scrollToSeek())}>
              -
            </span>
            <span className="text-center -mt-0.5 mb-0.5 inline-block align-middle w-auto h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800">
              {`${ZOOMS[currentZoom]}%`}
            </span>
            <span title="Zoom In" className="text-center cursor-pointer -mt-0.5 mb-0.5 inline-block align-middle w-12 h-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white hover:bg-gray-200 hover:text-gray-500 active:bg-gray-50 active:text-gray-800"
              onClick={() => (currentZoom+1 < ZOOMS.length ? setZoom(currentZoom+1) : scrollToSeek())}>
              +
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}