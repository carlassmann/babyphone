import { ConnectionIcon, SoundIcon } from '../../../icons';
import { useRoom } from '../room-context';

export function ActivityScreen() {
  const { events, isBaby, clearEvents } = useRoom();

  return (
    <section className="side-card activity">
      <div className="section-heading">
        <h3>Activity</h3>
        <span className="caption">Last 24 hours</span>
        {!isBaby && events.length > 0 && (
          <button type="button" className="quiet small" onClick={() => void clearEvents()}>
            Clear activity
          </button>
        )}
      </div>
      {events.length ? (
        <div className="event-list">
          {events.map((event) => (
            <div className="event" key={event.id}>
              <span className={`event-icon ${event.kind !== 'noise' ? 'warning' : ''}`}>
                {event.kind === 'noise' ? <SoundIcon size={17} /> : <ConnectionIcon size={17} />}
              </span>
              <div>
                <strong>
                  {event.kind === 'noise'
                    ? 'A little sound'
                    : event.kind === 'paused'
                      ? 'Monitoring paused'
                      : 'Device disconnected'}
                </strong>
                <span>{event.name}</span>
              </div>
              <time>
                {new Date(event.at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-events">
          <p>
            No activity yet.
            <br />
            Sound and connection events appear here.
          </p>
        </div>
      )}
    </section>
  );
}
