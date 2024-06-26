import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three';
import { CAST_CLOCK, getClock } from '../core/clock';
import { Signals, State, emit, receive } from '../core/state';
import { interpolateLine } from '../util/line';
import {
  getDanglingTrajectoryPoints,
  getTrajectoryPoints,
} from '../util/physics';
import { getBobberTopPoint } from './bobber';
import { getFishPosition } from './fish';
import { getFishingLineAnchorPoint } from './fisherman';
import { rootScene } from './scene';

export {
  getState as getFishingLineState,
  interpolatedPoints,
  launchTrajectoryPoints,
  setup as setupFishingLineAsync,
  update as updateFishingLine,
};

export const CAST_HEIGHT = 22;
export const CAST_TIME = 350; // ms
const DESCEND_TIME = 900; // ms

let fishingLine: Line;

const castClock = getClock(CAST_CLOCK);
let launchTrajectoryPoints: Vector3[];
let lineDescendedPoints: Vector3[];
let interpolatedPoints: Vector3[] = [];

async function setup() {
  fishingLine = new Line(
    new BufferGeometry(),
    new LineBasicMaterial({
      color: 'silver',
      transparent: true,
      opacity: 0.66,
    })
  );

  fishingLine.visible = false;

  rootScene.add(fishingLine);

  setupReceivers();
}

enum FishingLineState {
  HIDDEN = 'HIDDEN',
  CASTING = 'CASTING',
  DESCENDING = 'DESCENDING',
  ATTACHED_BOBBER = 'ATTACHED_BOBBER',
  ATTACHED_FISH = 'ATTACHED_FISH',
}
const { HIDDEN, CASTING, DESCENDING, ATTACHED_BOBBER, ATTACHED_FISH } =
  FishingLineState;

const { RESET, CAST, LAUNCH_BOBBER, BOBBER_LANDED, BEGIN_FISHING, HOOK } =
  Signals;

const state = new State<FishingLineState>(HIDDEN, null);

const getState = () => state.get();
const update = () => state.invoke();

function setupReceivers() {
  receive(RESET, () => {
    fishingLine.visible = false;
    state.set(HIDDEN, null);
  });

  receive(
    CAST,
    () => {
      fishingLine.geometry.dispose();
      fishingLine.visible = false;

      state.set(HIDDEN, null);
    },
    3 // prio
  );

  receive(
    LAUNCH_BOBBER,
    () => {
      fishingLine.visible = true;

      launchTrajectoryPoints = getTrajectoryPoints(
        getFishingLineAnchorPoint(),
        getBobberTopPoint(),
        CAST_HEIGHT
      );

      lineDescendedPoints = getDanglingTrajectoryPoints(
        getFishingLineAnchorPoint(),
        getBobberTopPoint()
      );

      interpolateLine(
        launchTrajectoryPoints,
        lineDescendedPoints,
        interpolatedPoints,
        0
      );

      fishingLine.geometry.setFromPoints(launchTrajectoryPoints);
      fishingLine.geometry.setDrawRange(0, 0);
      fishingLine.geometry.setDrawRange(0, 0);

      state.set(CASTING, () => {
        while_LAUNCHING();
        while_LINE_DESCENDING();
      });
    },
    1 // prio
  );

  receive(BOBBER_LANDED, () => {
    state.set(DESCENDING, while_LINE_DESCENDING);
  });

  receive(BEGIN_FISHING, () => {
    state.set(ATTACHED_BOBBER, while_ATTACHED_BOBBER);
  });

  receive(HOOK, () => {
    state.set(ATTACHED_FISH, while_ATTACHED_FISH);
  });
}

/// /// ///

let currentTimestep = 0;
function while_LAUNCHING() {
  const timestep = Math.floor(CAST_TIME / 32);
  const elapsed = castClock.getElapsedTime() * 1000;
  currentTimestep = Math.floor(elapsed / timestep);
  fishingLine.geometry.setDrawRange(0, currentTimestep);

  if (elapsed >= CAST_TIME) {
    emit(BOBBER_LANDED);
  }
}

function while_LINE_DESCENDING() {
  const elapsed = castClock.getElapsedTime() * 1000;
  const alpha = elapsed / DESCEND_TIME;

  let stopAt =
    currentTimestep > launchTrajectoryPoints.length
      ? undefined
      : currentTimestep;

  if (stopAt !== undefined && stopAt < launchTrajectoryPoints.length) {
    stopAt++;
  }

  interpolateLine(
    launchTrajectoryPoints,
    lineDescendedPoints,
    interpolatedPoints,
    alpha,
    stopAt
  );

  fishingLine.geometry.setFromPoints(interpolatedPoints);

  if (elapsed >= DESCEND_TIME) {
    castClock.stop();
    emit(BEGIN_FISHING);
  }
}

function while_ATTACHED_BOBBER() {
  const attachPoint = lineDescendedPoints[lineDescendedPoints.length - 1];
  attachPoint.copy(getBobberTopPoint());
  fishingLine.geometry.setFromPoints(lineDescendedPoints);
}

function while_ATTACHED_FISH() {
  fishingLine.geometry.setFromPoints([
    getFishingLineAnchorPoint(),
    getFishPosition(),
  ]);
}
