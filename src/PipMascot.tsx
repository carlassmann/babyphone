import { useEffect, useId, useRef, useState } from 'react';
import './PipMascot.css';
import { useIntl } from './intl/setup';

export type PipMascotState = 'paused' | 'quiet' | 'sound';

export function PipMascot({
  alt,
  className = '',
  state,
}: {
  alt: string;
  className?: string;
  state: PipMascotState;
}) {
  const t = useIntl();
  const id = useId();
  const [interacting, setInteracting] = useState(false);
  const [listening, setListening] = useState(state === 'sound');
  const interactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const awake = state === 'sound' || listening || interacting;

  useEffect(() => () => clearTimeout(interactionTimer.current), []);

  useEffect(() => {
    if (state !== 'quiet') {
      setListening(state === 'sound');
      return;
    }
    const settleTimer = setTimeout(() => setListening(false), 1400);
    return () => clearTimeout(settleTimer);
  }, [state]);

  function wake() {
    clearTimeout(interactionTimer.current);
    setInteracting(true);
    interactionTimer.current = setTimeout(() => setInteracting(false), 3200);
  }

  return (
    <button
      type="button"
      className={`monitor-mascot ${className} ${state}`}
      data-testid="pip-mascot"
      data-state={state}
      data-pose={awake ? 'awake' : 'sleeping'}
      aria-label={t('mascot.stir')}
      onClick={wake}
      onPointerEnter={(event) => {
        if (
          event.pointerType === 'mouse' &&
          window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ) {
          wake();
        }
      }}
    >
      <svg
        className="pip-character"
        viewBox="0 0 360 280"
        role="img"
        aria-label={awake ? t('mascot.awake') : alt}
      >
        <defs>
          <radialGradient id={`${id}-down`} cx="35%" cy="25%" r="80%">
            <stop stopColor="#fff1b5" />
            <stop offset="0.6" stopColor="#ffdf87" />
            <stop offset="1" stopColor="#efbd59" />
          </radialGradient>
          <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#ffeab0" />
            <stop offset="1" stopColor="#f3c66f" />
          </linearGradient>
          <linearGradient id={`${id}-nest`} x1="0" y1="0" x2="0.3" y2="1">
            <stop stopColor="#bfd8ee" />
            <stop offset="1" stopColor="#89afd4" />
          </linearGradient>
          <radialGradient id={`${id}-blush`}>
            <stop stopColor="#f5ab94" stopOpacity="0.8" />
            <stop offset="1" stopColor="#f5ab94" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          className="pip-shadow"
          cx="184"
          cy="254"
          rx="107"
          ry="10"
          fill="#55799e"
          opacity="0.13"
        />
        <path
          d="M48 185 Q58 159 92 179 Q186 218 272 176 Q304 155 317 184 Q300 241 183 247 Q69 241 48 185Z"
          fill="#7c9fc4"
        />
        <g className="pip-body-posture">
          <g className="pip-breath">
            <path
              d="M150 120 Q196 94 241 115 Q288 136 286 186 Q283 225 218 230 L138 217 Q102 191 119 153Z"
              fill={`url(#${id}-down)`}
            />
            <ellipse cx="194" cy="192" rx="53" ry="31" fill="#fff0b4" opacity="0.5" />
            <path
              d="M237 129 l5 -3 M249 141 l5 -2 M252 154 l5 1 M234 147 l4 -2"
              className="pip-feather-lines"
            />
          </g>
        </g>
        <g className="pip-head-posture">
          <g className="pip-head-breathe">
            <g className="pip-tuft">
              <path
                d="M130 74 C112 62 109 47 117 47 Q128 46 137 64 C132 43 137 31 144 36 Q156 44 148 71Z"
                fill={`url(#${id}-down)`}
              />
            </g>
            <path
              d="M87 165 C70 143 75 111 89 91 C101 70 122 62 148 64 C179 62 204 81 213 110 C222 137 209 160 194 176 C180 193 147 199 119 188 Q98 181 87 165Z"
              fill={`url(#${id}-down)`}
            />
            <path
              d="M91 123 Q96 91 124 83 M130 80 l5 -1"
              fill="none"
              stroke="#fff6cf"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.55"
            />
            <ellipse cx="107" cy="158" rx="20" ry="15" fill={`url(#${id}-blush)`} />
            <ellipse cx="180" cy="152" rx="21" ry="16" fill={`url(#${id}-blush)`} />
            <g className="pip-face">
              <g
                className="pip-eyes-closed"
                fill="none"
                stroke="#52667c"
                strokeWidth="4.5"
                strokeLinecap="round"
              >
                <path d="M106 133 Q114 142 124 133" />
                <path d="M153 132 Q166 145 178 130" />
              </g>
              <g className="pip-eyes-open">
                <g className="pip-blink">
                  <ellipse cx="116" cy="132" rx="6.5" ry="10" fill="#465b73" />
                  <ellipse cx="166" cy="131" rx="8" ry="12" fill="#465b73" />
                  <g className="pip-eye-glints" fill="#fffdf2">
                    <ellipse cx="118" cy="128" rx="2.1" ry="2.8" />
                    <ellipse cx="169" cy="127" rx="2.7" ry="3.3" />
                    <circle cx="163" cy="135" r="1.4" opacity="0.65" />
                  </g>
                </g>
              </g>
              <g className="pip-beak" transform="translate(132 151)">
                <path d="M-10 0 Q1 -8 13 -2 Q14 3 2 10 Q-5 9 -10 0Z" fill="#e9a132" />
                <path
                  className="pip-beak-lower"
                  d="M-8 2 Q1 7 12 0 Q7 15 1 14 Q-5 12 -8 2Z"
                  fill="#d98a2b"
                />
                <path d="M-10 0 Q1 -9 13 -2 Q10 4 2 6 Q-4 5 -10 0Z" fill="#ffbf50" />
                <path
                  d="M-5 -1 Q1 -4 6 -3"
                  fill="none"
                  stroke="#ffdc84"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>
        </g>
        <g className="pip-wing-posture">
          <g className="pip-wing-breathe">
            <path
              d="M248 142 C258 151 244 172 238 178 C250 182 241 199 228 202 C232 212 214 222 192 220 C175 222 162 216 159 209 Q184 159 226 144 Q240 139 248 142Z"
              fill="#c69b4b"
              opacity="0.14"
              transform="translate(0 3)"
            />
            <path
              d="M248 139 C258 148 244 169 238 175 C250 179 241 196 228 199 C232 209 214 219 192 217 C175 219 162 213 159 206 Q184 156 226 141 Q240 136 248 139Z"
              fill={`url(#${id}-wing)`}
            />
            <path
              d="M176 192 Q201 158 235 149 M189 197 Q213 181 230 177"
              className="pip-feather-lines"
            />
          </g>
        </g>
        <path
          d="M48 177 C58 168 76 195 98 207 Q185 257 273 207 C294 194 307 170 317 179 C325 187 309 230 281 245 Q189 286 91 244 C62 231 42 193 48 177Z"
          fill={`url(#${id}-nest)`}
        />
        <path
          d="M55 184 Q96 242 180 244 Q261 247 309 186"
          fill="none"
          stroke="#d8e8f6"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M106 237 q15 7 31 9 M145 248 l8 1 M251 235 l12 -5"
          fill="none"
          stroke="#749bc2"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
        <g
          className="pip-sleep-marks"
          fill="none"
          stroke="#7e98b5"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="pip-sleep-mark" d="M238 84 h9 l-9 10 h9" />
          <path className="pip-sleep-mark" d="M259 60 h12 l-12 13 h12" />
        </g>
        <g
          className="pip-sound-marks"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M278 101 q7 8 0 16" />
          <path d="M288 94 q13 15 0 30" />
        </g>
      </svg>
    </button>
  );
}
