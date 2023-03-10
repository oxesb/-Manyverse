/* Copyright (C) 2018-2019 The Manyverse Authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import xs, {Stream} from 'xstream';
import {ReactElement} from 'react';
import {Command, NavSource} from 'cycle-native-navigation';
import {ReactSource} from '@cycle/react';
import {Reducer, StateSource} from '@cycle/state';
import isolate from '@cycle/isolate';
import {SSBSource} from '../../drivers/ssb';
import {Toast} from '../../drivers/toast';
import {DialogSource} from '../../drivers/dialogs';
import {topBar, Sinks as TBSinks} from './top-bar';
import navigation from './navigation';
import view from './view';
import model, {State, topBarLens} from './model';
import dialog from './dialog';

export type Props = {
  practiceMode?: boolean;
  backendWords?: string;
};

export type Sources = {
  screen: ReactSource;
  navigation: NavSource;
  props: Stream<Props>;
  state: StateSource<State>;
  dialog: DialogSource;
  ssb: SSBSource;
};

export type Sinks = {
  keyboard: Stream<'dismiss'>;
  screen: Stream<ReactElement<any>>;
  navigation: Stream<Command>;
  toast: Stream<Toast>;
  state: Stream<Reducer<State>>;
};

export const navOptions = {
  topBar: {
    visible: false,
    height: 0,
  },
};

function intent(
  navSource: NavSource,
  screenSource: ReactSource,
  back$: Stream<any>,
) {
  return {
    goBack$: xs.merge(navSource.backPress(), back$),

    updateWords$: screenSource
      .select('inputField')
      .events('changeText') as Stream<string>,

    confirm$: screenSource.select('confirm').events('press'),
  };
}

export function secretInput(sources: Sources): Sinks {
  const topBarSinks: TBSinks = isolate(topBar, {
    '*': 'topBar',
    state: topBarLens,
  })(sources);

  const state$ = sources.state.stream;
  const actions = intent(sources.navigation, sources.screen, topBarSinks.back);
  const confirmation$ = dialog(actions, state$, sources.ssb, sources.dialog);
  const dismissKeyboard$ = actions.goBack$.mapTo('dismiss' as 'dismiss');
  const vdom$ = view(state$, topBarSinks.screen);
  const command$ = navigation(state$, actions, confirmation$);
  const reducer$ = model(sources.props, actions);

  return {
    keyboard: dismissKeyboard$,
    screen: vdom$,
    navigation: command$,
    toast: xs.never(),
    state: reducer$,
  };
}
