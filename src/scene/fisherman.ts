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
import { aimPoint } from '../controls/aim';
import { delta } from '../core/time';
import { getTopBobberPoint } from './bobber';
import { isSpaceDown } from '../controls/reel';
import { getFishPosition } from './fish';
import {
  ON_CASTING,
  ON_FISH_CAUGHT,
  ON_FISH_FIGHT,
  RESET,
  STATE_CHANGE,
  receive,
  transmit,
  ON_FISHING,
  ON_FISH_ON,
} from '../events/event_manager';

let fisherman: Group;

let fishermanMixer: AnimationMixer;
let castAnimAction: AnimationAction;

type FishermanState =
  | 'IDLE'
  | 'CASTING'
  | 'FISHING'
  | 'FISH_ON'
  | 'REELING'
  | 'HOLDING_PRIZE';

let fishermanState: FishermanState = 'IDLE';

export function getFishermanState() {
  return fishermanState;
}
function setFishermanState(state: FishermanState) {
  fishermanState = state;
  transmit(STATE_CHANGE);
}

function is(s: FishermanState) {
  return fishermanState === s;
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
  fishermanMixer.addEventListener('finished', () => {
    setFishermanState('FISHING');
    transmit(ON_FISHING);
  });

  // receivers
  receive(RESET, () => {
    setFishermanState('IDLE');
  });
  receive(ON_FISH_ON, () => {
    setFishermanState('FISH_ON');
  });
  receive(ON_FISH_FIGHT, () => {
    setFishermanState('REELING');
  });
  receive(ON_FISH_CAUGHT, () => {
    setFishermanState('HOLDING_PRIZE');
  });
}

export function updateFisherman() {
  fishermanMixer.update(delta * 3);

  if (is('IDLE')) {
    fisherman.lookAt(aimPoint);
    return;
  }

  if (!(is('FISH_ON') || is('REELING')) && isSpaceDown) {
    setFishermanState('IDLE');
    return;
  }

  if (is('CASTING') || is('FISHING')) {
    fisherman.lookAt(getTopBobberPoint());
    return;
  }

  if (is('FISH_ON') && isSpaceDown) {
    transmit(ON_FISH_FIGHT);
    return;
  }

  if (is('REELING')) {
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
  if (is('IDLE') || is('FISHING') || is('FISH_ON')) {
    setFishermanState('CASTING');
    transmit(ON_CASTING);
    castAnimAction.reset();
  }

  castAnimAction.play().repetitions = 1;
}

export function castAnimationIsPlaying() {
  return castAnimAction.isRunning();
}

export function getFishermanPosition() {
  return fisherman.position.clone();
}
