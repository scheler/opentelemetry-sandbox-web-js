/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { diag } from '@opentelemetry/api';
import { BasePlugin } from '@opentelemetry/core';
import type * as ioredisTypes from 'ioredis';
import * as shimmer from 'shimmer';
import { IoredisPluginConfig } from './types';
import { traceConnection, traceSendCommand } from './utils';
import { VERSION } from './version';

export class IORedisPlugin extends BasePlugin<typeof ioredisTypes> {
  static readonly DB_SYSTEM = 'redis';
  readonly supportedVersions = ['>1 <5'];
  protected _config!: IoredisPluginConfig;

  constructor(readonly moduleName: string) {
    super('@opentelemetry/plugin-ioredis', VERSION);
  }

  protected patch(): typeof ioredisTypes {
    diag.debug('Patching ioredis.prototype.sendCommand');
    shimmer.wrap(
      this._moduleExports.prototype,
      'sendCommand',
      this._patchSendCommand()
    );

    diag.debug('patching ioredis.prototype.connect');
    shimmer.wrap(
      this._moduleExports.prototype,
      'connect',
      this._patchConnection()
    );

    return this._moduleExports;
  }

  protected unpatch(): void {
    if (this._moduleExports) {
      shimmer.unwrap(this._moduleExports.prototype, 'sendCommand');
      shimmer.unwrap(this._moduleExports.prototype, 'connect');
    }
  }

  /**
   * Patch send command internal to trace requests
   */
  private _patchSendCommand() {
    const tracer = this._tracer;
    return (original: Function) => {
      return traceSendCommand(tracer, original, plugin._config);
    };
  }

  private _patchConnection() {
    const tracer = this._tracer;
    return (original: Function) => {
      return traceConnection(tracer, original);
    };
  }
}

export const plugin = new IORedisPlugin('ioredis');
