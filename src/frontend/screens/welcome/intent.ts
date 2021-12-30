// SPDX-FileCopyrightText: 2018-2021 The Manyverse Authors
//
// SPDX-License-Identifier: MPL-2.0

import xs, {Stream} from 'xstream';
import {Platform} from 'react-native';
import {ReactSource} from '@cycle/react';
import {AsyncStorageSource} from 'cycle-native-asyncstorage';
import path = require('path');
import {FSSource} from '../../drivers/fs';
import {GlobalEvent} from '../../drivers/eventbus';
import {DialogSource} from '../../drivers/dialogs';
import {Palette} from '../../global-styles/palette';
import {t} from '../../drivers/localization';

export default function intent(
  globalEventBus: Stream<GlobalEvent>,
  screenSource: ReactSource,
  fsSource: FSSource,
  dialogSource: DialogSource,
  storageSource: AsyncStorageSource,
) {
  const isWeb = Platform.OS === 'web';
  const oldLogPath = isWeb
    ? path.join(process.env.SSB_DIR!, 'flume', 'log.offset')
    : path.join(FSSource.DocumentDirectoryPath, '.ssb', 'flume', 'log.offset');
  const newLogPath = isWeb
    ? path.join(process.env.SSB_DIR!, 'db2', 'log.bipf')
    : path.join(FSSource.DocumentDirectoryPath, '.ssb', 'db2', 'log.bipf');

  const accountExists$ = xs
    .combine(fsSource.exists(oldLogPath), fsSource.exists(newLogPath))
    .map(([oldLogExists, newLogExists]) => {
      if (!oldLogExists && !newLogExists) return xs.of(false);
      const oldLogSize$ = oldLogExists
        ? fsSource.stat(oldLogPath).map((stat: any) => stat.size as number)
        : xs.of(0);
      const newLogSize$ = newLogExists
        ? fsSource.stat(newLogPath).map((stat: any) => stat.size as number)
        : xs.of(0);
      return xs
        .combine(oldLogSize$, newLogSize$)
        .map(
          ([oldLogSize, newLogSize]) => oldLogSize >= 10 || newLogSize >= 10,
        );
    })
    .flatten();

  const hasBeenVisited$ = storageSource.getItem('latestVisit').map((x) => !!x);

  const localizationLoaded$ = globalEventBus
    .filter((ev) => ev.type === 'localizationLoaded')
    .take(1)
    .mapTo(true);

  return {
    createAccount$: screenSource.select('create-account').events('press'),

    restoreAccount$: screenSource.select('restore-account').events('press'),

    migrateAccount$: screenSource
      .select('migrate-account')
      .events('press')
      .map(() =>
        dialogSource
          .alert(
            t('welcome.dialogs.migrate.title'),
            t('welcome.dialogs.migrate.description'),
            {
              ...Palette.dialogColors,
              negativeText: t('call_to_action.cancel'),
              positiveText: t('call_to_action.yes'),
              markdownOnDesktop: true,
            },
          )
          .filter((res) => res.action === 'actionPositive'),
      )
      .flatten(),

    skipOrNot$: xs
      .combine(localizationLoaded$, accountExists$, hasBeenVisited$)
      .map(
        ([localizationLoaded, accountExists, hasBeenVisited]) =>
          localizationLoaded && (accountExists || hasBeenVisited),
      ),

    scrollBy$: xs
      .merge(
        screenSource.select('overview-continue').events('press').mapTo(1),
        screenSource.select('offgrid-continue').events('press').mapTo(1),
        screenSource.select('connections-continue').events('press').mapTo(1),
        screenSource.select('moderation-continue').events('press').mapTo(1),
        screenSource
          .select('permanence-continue')
          .events('press')
          .mapTo(Platform.OS === 'ios' ? 2 : 1),
        screenSource.select('inconstruction-continue').events('press').mapTo(1),
      )
      .map((offset) => [offset, /* animated */ true] as [number, boolean]),

    pageChanged$: screenSource.select('swiper').events('indexChanged'),

    learnMoreSSB$: screenSource.select('learn-more-ssb').events('press'),

    learnMoreOffGrid$: screenSource
      .select('learn-more-off-grid')
      .events('press'),

    learnMoreConnections$: screenSource
      .select('learn-more-connections')
      .events('press'),

    learnMoreModeration$: screenSource
      .select('learn-more-moderation')
      .events('press'),

    learnMorePermanence$: screenSource
      .select('learn-more-permanence')
      .events('press'),
  };
}
