import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import sceneRoot from './scene';
import { setupFishingLine } from './fishing_line';
import { aimPoint, showReticle } from '../controls/aim';
import { delta } from '../core/time';
import {
  cancelBobberPlunk,
  getTopBobberPoint,
  hideBobber,
  plopBobber,
  setPlunkTimer,
  showBobber,
} from './bobber';
import { hideUI_fishOn, showUI_fishOn } from '../ui/ui_fish_on';
import { isSpaceDown } from '../controls/reel';
import { hideUI_fishHealth, showUI_fishHealth } from '../ui/ui_fish_health';
import { hideUI_lineTension, showUI_lineTension } from '../ui/ui_line_tension';
import { getFishPosition, moveFishBelowBobber } from './fish';
import { STATE_CHANGE_EVENT, eventManager } from '../events/event_manager';

let fisherman: Group;

let fishermanMixer: AnimationMixer;
let castAnimAction: AnimationAction;

export type FishermanState =
  | 'IDLE'
  | 'CASTING'
  | 'FISHING'
  | 'FISH_ON'
  | 'REELING';

export let fishermanState: FishermanState = 'IDLE';

export function getFishermanState() {
  return fishermanState;
}
export function setFishermanState(state: FishermanState) {
  fishermanState = state;
  eventManager.dispatchEvent(STATE_CHANGE_EVENT);
}
export const isIDLE = () => fishermanState === 'IDLE';
export const isCASTING = () => fishermanState === 'CASTING';
export const isFISHING = () => fishermanState === 'FISHING';
export const isFISH_ON = () => fishermanState === 'FISH_ON';
export const isREELING = () => fishermanState === 'REELING';

export function setFishermanState_IDLE() {
  setFishermanState('IDLE');
  hideBobber();
  showReticle();
  hideUI_fishOn();
  hideUI_fishHealth();
  hideUI_lineTension();
}

export function setFishermanState_CASTING() {
  setFishermanState('CASTING');
  hideBobber();
  plopBobber();
  hideUI_fishHealth();
}

export function setFishermanState_FISHING() {
  setFishermanState('FISHING');
  showBobber();
  setPlunkTimer();
}

export function setFishermanState_FISH_ON() {
  setFishermanState('FISH_ON');
  showUI_fishOn();
}

export function setFishermanState_REELING() {
  setFishermanState('REELING');
  moveFishBelowBobber();
  hideUI_fishOn();
  hideBobber();
  cancelBobberPlunk();
  showUI_fishHealth();
  showUI_lineTension();
}

export async function setupFishermanAsync() {
  const loader = new GLTFLoader();

  const loaded = await loader.loadAsync('/models/fisherman.glb');

  fisherman = loaded.scene as Group;

  fisherman.scale.set(10, 10, 10);

  sceneRoot.add(fisherman);

  setupFishingLine();

  // setup animation
  fishermanMixer = new AnimationMixer(fisherman);
  const animations = loaded.animations;
  const castAnimClip = AnimationClip.findByName(animations, 'cast_anim');
  castAnimAction = fishermanMixer.clipAction(castAnimClip);
  fishermanMixer.addEventListener('finished', setFishermanState_FISHING);
}

export function updateFisherman() {
  fishermanMixer.update(delta * 3);

  if (isIDLE()) {
    fisherman.lookAt(aimPoint);
    return;
  }

  if (isCASTING() || isFISHING()) {
    fisherman.lookAt(getTopBobberPoint());
    return;
  }

  if (isFISH_ON() && isSpaceDown) {
    setFishermanState_REELING();
    return;
  }

  if (isREELING()) {
    fisherman.lookAt(getFishPosition());
    return;
  }
}

// util

export function getFishingLineAnchorPoint(): Vector3 {
  let p = new Vector3();
  fisherman.getObjectByName('string_pivot')?.getWorldPosition(p);
  return p;
}

export function playCastAnimation() {
  // play animation if not in middle of casting
  if (!isCASTING()) {
    setFishermanState_CASTING();
    castAnimAction.reset();
  }

  castAnimAction.play().repetitions = 1;
}

export function castAnimationIsPlaying() {
  return castAnimAction.isRunning();
}
