import PropTypes from 'prop-types';
import React, { Component } from 'react';
import classNames from 'classnames';

import Manager from '../Manager';

import BigPlayButton from './BigPlayButton';
import LoadingSpinner from './LoadingSpinner';
import PosterImage from './PosterImage';
import Video from './Video';
import Audio from './Audio';
import Bezel from './Bezel';
import Warning from './Warning';
import Shortcut from './Shortcut';
import ControlBar from './control-bar/ControlBar';

import * as browser from '../utils/browser';
import { mergeAndSortChildren, isMediaChild, throttle } from '../utils';
import fullscreen from '../utils/fullscreen';

const propTypes = {
  children: PropTypes.any,
  mediaType: PropTypes.string,

  width: PropTypes.number,
  height: PropTypes.number,
  fluid: PropTypes.bool,
  muted: PropTypes.bool,
  playsInline: PropTypes.bool,
  aspectRatio: PropTypes.string,
  className: PropTypes.string,
  videoId: PropTypes.string,

  startTime: PropTypes.number,
  loop: PropTypes.bool,
  autoPlay: PropTypes.bool,
  src: PropTypes.string,
  poster: PropTypes.string,
  preload: PropTypes.oneOf(['auto', 'metadata', 'none']),

  onLoadStart: PropTypes.func,
  onWaiting: PropTypes.func,
  onCanPlay: PropTypes.func,
  onCanPlayThrough: PropTypes.func,
  onPlaying: PropTypes.func,
  onEnded: PropTypes.func,
  onSeeking: PropTypes.func,
  onSeeked: PropTypes.func,
  onPlay: PropTypes.func,
  onPause: PropTypes.func,
  onProgress: PropTypes.func,
  onDurationChange: PropTypes.func,
  onError: PropTypes.func,
  onSuspend: PropTypes.func,
  onAbort: PropTypes.func,
  onEmptied: PropTypes.func,
  onStalled: PropTypes.func,
  onLoadedMetadata: PropTypes.func,
  onLoadedData: PropTypes.func,
  onTimeUpdate: PropTypes.func,
  onRateChange: PropTypes.func,
  onVolumeChange: PropTypes.func,

  store: PropTypes.object
};

const defaultProps = {
  fluid: true,
  muted: false,
  playsInline: false,
  aspectRatio: 'auto',
};


export default class Player extends Component {
  constructor(props) {
    super(props);

    this.controlsHideTimer = null;

    this.media = null; // the Video component
    this.manager = new Manager(props.store);
    this.actions = this.manager.getActions();
    this.manager.subscribeToPlayerStateChange(this.handleStateChange.bind(this));

    this.getStyle = this.getStyle.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.getChildren = this.getChildren.bind(this);
    this.handleMouseMove = throttle(this.handleMouseMove.bind(this), 250);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.startControlsTimer = this.startControlsTimer.bind(this);
    this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  componentDidMount() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    fullscreen.addEventListener(this.handleFullScreenChange);
  }

  componentWillUnmount() {
    // Remove event listener
    window.removeEventListener('resize', this.handleResize);
    fullscreen.removeEventListener(this.handleFullScreenChange);
    if (this.controlsHideTimer) {
      window.clearTimeout(this.controlsHideTimer);
    }
  }

  getDefaultChildren(props, fullProps) {
    let MediaElememt = Video
    if (props.mediaType === 'audio') {
      MediaElememt = Audio
    } 

    return [
      <MediaElememt 
        ref={(c) => {
          this.media = c;
          this.manager.media = this.media;
        }}
        key={props.mediaType}
        order={0.0}
        {...fullProps}
      />,
      <PosterImage
        key="poster-image"
        order={1.0}
        {...props}
      />,
      <LoadingSpinner
        key="loading-spinner"
        order={2.0}
        {...props}
      />,
      <Bezel
        key="bezel"
        order={3.0}
        {...props}
      />,
      <BigPlayButton
        key="big-play-button"
        order={4.0}
        {...props}
      />,
      <ControlBar
        key="control-bar"
        order={5.0}
        {...props}
      />,
      <Shortcut
        key="shortcut"
        order={99.0}
        {...props}
      />,
      <Warning 
        key="warning"
        order={99.0}
        {...props}
      />,
    ];
  }

  getChildren(props) {
    const propsWithoutChildren = {
      ...props,
      children: null
    };
    const children = React.Children.toArray(this.props.children)
      .filter(e => (!isMediaChild(e)));
    const defaultChildren = this.getDefaultChildren(propsWithoutChildren, props);
    return mergeAndSortChildren(defaultChildren, children, propsWithoutChildren);
  }

  getStyle() {
    const { fluid, mediaType } = this.props;
    const { player } = this.manager.getState();
    const style = {};
    let width;
    let height;
    let aspectRatio;

    if (mediaType === 'audio') {
      return {
        height: '140px',
      }
    }

    // The aspect ratio is either used directly or to calculate width and height.
    if (this.props.aspectRatio !== undefined
      && this.props.aspectRatio !== 'auto') {
      // Use any aspectRatio that's been specifically set
      aspectRatio = this.props.aspectRatio;
    } else if (player.videoWidth) {
      // Otherwise try to get the aspect ratio from the video metadata
      if (player.videoWidth >= player.videoHeight) {
        aspectRatio = `${player.videoWidth}:${player.videoHeight}`;
      } else {
        aspectRatio = `${player.videoHeight}:${player.videoWidth}`;
      }
    } else {
      // Or use a default. The video element's is 2:1, but 16:9 is more common.
      aspectRatio = '16:9';
    }

    // Get the ratio as a decimal we can use to calculate dimensions
    const ratioParts = aspectRatio.split(':');
    const ratioMultiplier = ratioParts[1] / ratioParts[0];

    if (this.props.width !== undefined) {
      // Use any width that's been specifically set
      width = this.props.width;
    } else if (this.props.height !== undefined) {
      // Or calulate the width from the aspect ratio if a height has been set
      width = this.props.height / ratioMultiplier;
    } else {
      // Or use the video's metadata, or use the video el's default of 300
      width = player.videoWidth || 400;
    }

    if (this.props.height !== undefined) {
      // Use any height that's been specifically set
      height = this.props.height;
    } else {
      // Otherwise calculate the height from the ratio and the width
      height = width * ratioMultiplier;
    }

    if (fluid) {
      style.paddingTop = `${ratioMultiplier * 100}%`;
    } else {
      style.width = `${width}px`;
      style.height = `${height}px`;
    }

    return style;
  }

  // get redux state
  // { player, operation }
  getState() {
    return this.manager.getState();
  }

  // get playback rate
  get playbackRate() {
    return this.media.playbackRate;
  }

  // set playback rate
  // speed of video
  set playbackRate(rate) {
    this.media.playbackRate = rate;
  }

  get muted() {
    return this.media.muted;
  }

  set muted(val) {
    this.media.muted = val;
  }

  get volume() {
    return this.media.volume;
  }

  set volume(val) {
    this.media.volume = val;
  }

  // video width
  get videoWidth() {
    return this.media.videoWidth;
  }

  // video height
  get videoHeight() {
    return this.media.videoHeight;
  }

  // play the video
  play() {
    this.media.play();
  }

  // pause the video
  pause() {
    this.media.pause();
  }

  // Change the video source and re-load the video:
  load() {
    this.media.load();
  }

  // Add a new text track to the video
  addTextTrack(...args) {
    this.media.addTextTrack(...args);
  }

  // Check if your browser can play different types of video:
  canPlayType(...args) {
    this.media.canPlayType(...args);
  }

  // seek video by time
  seek(time) {
    this.media.seek(time);
  }

  // jump forward x seconds
  forward(seconds) {
    this.media.forward(seconds);
  }

  // jump back x seconds
  replay(seconds) {
    this.media.replay(seconds);
  }

  // enter or exist full screen
  toggleFullscreen() {
    this.media.toggleFullscreen();
  }

  // subscribe to player state change
  subscribeToStateChange(listener) {
    return this.manager.subscribeToPlayerStateChange(listener);
  }

  // player resize
  handleResize() {
  }

  handleFullScreenChange() {
    this.actions.handleFullscreenChange(fullscreen.isFullscreen);
  }

  handleMouseDown() {
    this.startControlsTimer();
  }

  handleMouseMove() {
    this.startControlsTimer();
  }

  handleKeyDown() {
    this.startControlsTimer();
  }

  startControlsTimer() {
    this.actions.userActivate(true);
    clearTimeout(this.controlsHideTimer);
    this.controlsHideTimer = setTimeout(() => {
      this.actions.userActivate(false);
    }, 3000);
  }

  handleStateChange(state, prevState) {
    if (state.isFullscreen !== prevState.isFullscreen) {
      this.handleResize();
    }
    this.forceUpdate(); // re-render
  }

  handleFocus() {
    this.actions.activate(true);
  }

  handleBlur() {
    this.actions.activate(false);
  }

  render() {
    const { fluid, mediaType } = this.props;
    const { player } = this.manager.getState();
    const { paused, hasStarted, waiting, seeking, isFullscreen, userActivity } = player;

    const props = {
      ...this.props,
      player,
      actions: this.actions,
      manager: this.manager,
      store: this.manager.store,
      video: this.media ? this.media.video : null,
    };
    const children = this.getChildren(props);

    return (
      <div
        className={classNames({
          'video-react-controls-enabled': true,
          'video-react-has-started': hasStarted,
          'video-react-paused': paused,
          'video-react-playing': !paused,
          'video-react-waiting': waiting,
          'video-react-seeking': seeking,
          'video-react-fluid': fluid,
          'video-react-fullscreen': isFullscreen,
          'video-react-user-inactive': !userActivity,
          'video-react-user-active': userActivity,
          'video-react-workinghover': !browser.IS_IOS,
          'video-react-audio-wrapper': mediaType === 'audio',
        }, 'video-react', this.props.className)}
        style={this.getStyle()}
        ref={(c) => {
          this.manager.rootElement = c;
        }}
        onTouchStart={this.handleMouseDown}
        onMouseDown={this.handleMouseDown}
        onMouseMove={this.handleMouseMove}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        tabIndex="-1"
      >
        {children}
      </div>
    );
  }
}

Player.contextTypes = { store: PropTypes.object };
Player.propTypes = propTypes;
Player.defaultProps = defaultProps;
Player.displayName = 'Player';
