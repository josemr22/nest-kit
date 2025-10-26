import { ConsoleLogger, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { KnownSeverityLevel, TelemetryClient } from 'applicationinsights';

@Injectable({
    scope: Scope.TRANSIENT
})
export class LoggerService extends ConsoleLogger {

    constructor(
        @Inject('ApplicationInsight') private readonly appInsights: TelemetryClient,
        @Inject(REQUEST) private request: any
    ) {
        super();
    }

    log(message: any) {
        const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.appInsights.trackTrace({
            message: formattedMessage, properties: {
                ...this.request.context?.executionContext,
            }, severity: KnownSeverityLevel.Information
        });
        super.log(message);
    }
    error(message: any) {
        const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.appInsights.trackException({ exception: new Error(formattedMessage), properties: {} });
        super.error(message);
    }
    critical(message: any) {
        const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.appInsights.trackException({ exception: new Error(formattedMessage), properties: {}, severity: KnownSeverityLevel.Critical });
        super.error(message);
    }
    warn(message: any) {
        const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.appInsights.trackTrace({ message: formattedMessage, properties: {}, severity: KnownSeverityLevel.Warning });
        super.warn(message);
    }
    debug(message: any) {
        const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        this.appInsights.trackTrace({ message: formattedMessage, properties: {}, severity: KnownSeverityLevel.Verbose });
        super.debug(message);
    }
}
