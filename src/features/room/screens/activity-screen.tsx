import { ConnectionIcon, SoundIcon } from '../../../icons';
import { useRoom } from '../room-context';
import { T, useIntl, useLocale } from '../../../intl/setup';

export function ActivityScreen() {
  const t = useIntl();
  const locale = useLocale();
  const { events, isBaby, clearEvents } = useRoom();

  return (
    <section className="side-card activity">
      <div className="section-heading">
        <h3>{t('activity.title')}</h3>
        <span className="caption">{t('activity.last24h')}</span>
        {!isBaby && events.length > 0 && (
          <button
            type="button"
            className="quiet small"
            data-testid="clear-activity"
            onClick={() => void clearEvents()}
          >
            {t('activity.clear')}
          </button>
        )}
      </div>
      {events.length ? (
        <div className="event-list">
          {events.map((event) => (
            <div
              className="event"
              key={event.id}
              data-testid="activity-event"
              data-kind={event.kind}
              data-device-name={event.name}
            >
              <span className={`event-icon ${event.kind !== 'noise' ? 'warning' : ''}`}>
                {event.kind === 'noise' ? <SoundIcon size={17} /> : <ConnectionIcon size={17} />}
              </span>
              <div>
                <strong>
                  {event.kind === 'noise'
                    ? t('activity.noise')
                    : event.kind === 'paused'
                      ? t('activity.paused')
                      : t('activity.offline')}
                </strong>
                <span>{event.name}</span>
              </div>
              <time>
                {new Date(event.at).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-events" data-testid="activity-empty">
          <p>
            <T k="activity.empty" components={{ br: () => <br /> }} />
          </p>
        </div>
      )}
    </section>
  );
}
