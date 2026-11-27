import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReportVerificationForm } from "@/components/examinations/report-verification-form";

/* eslint-disable @next/next/no-css-tags -- The design system is served as public assets for its runtime modules. */
const navigation = [
  { href: "#platform", label: "Examinations" },
  { href: "#questions", label: "Questions" },
  { href: "#workflow", label: "Workflow" },
  { href: "#reports", label: "Reports" },
];

function Arrow() {
  return (
    <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path className="m-arrow__stem" d="M1 6h8" />
      <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}

function BrandImage({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      alt=""
      height={315}
      priority={priority}
      src="/evalify-wordmark.png"
      width={1235}
    />
  );
}

function QuestionFormats() {
  return (
    <div className="hero-formats">
      <div className="hero-format">
        <span className="format-mark format-mark--radio" />
        <span>
          <strong>Single choice</strong>
          <small>Select one answer</small>
        </span>
        <span className="format-chevron" />
      </div>
      <div className="hero-format">
        <span className="format-mark format-mark--check" />
        <span>
          <strong>Multiple select</strong>
          <small>Select all that apply</small>
        </span>
        <span className="format-chevron" />
      </div>
      <div className="hero-format">
        <span className="format-mark format-mark--text" />
        <span>
          <strong>Written response</strong>
          <small>Enter a response</small>
        </span>
        <span className="format-chevron" />
      </div>
    </div>
  );
}

function ExaminerWorkspace() {
  const areas = [
    "Examinations",
    "Question bank",
    "Candidate enrollment",
    "Attempt monitoring",
    "Attempt progress",
    "Browser events",
    "Evaluation queue",
    "Result reports",
    "Public verification",
  ];

  return (
    <div
      className="app ui fill landing-app"
      role="img"
      aria-label="Examiner workspace with examination settings, question assignment, monitoring, evaluation and reports"
    >
      <div className="app__pane app__pane--list" aria-hidden="true">
        <div className="landing-app__navigation">
          <p className="landing-app__eyebrow">Examiner workspace</p>
          <ul>
            {areas.map((area, index) => (
              <li
                className={index === 0 ? "is-current" : undefined}
                key={area}
              >
                <span className="landing-app__nav-mark" />
                {area}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="app__pane app__pane--open" aria-hidden="true">
        <div className="landing-app__content">
          <div className="landing-app__heading">
            <div>
              <p className="landing-app__eyebrow">Examinations</p>
              <p className="landing-app__title">New examination</p>
            </div>
            <span className="landing-app__status">Draft</span>
          </div>
          <div className="landing-app__fields">
            <div className="landing-app__field landing-app__field--wide">
              <span>Examination title</span>
              <div className="landing-app__input" />
            </div>
            <div className="landing-app__field landing-app__field--wide">
              <span>Candidate instructions</span>
              <div className="landing-app__input landing-app__input--tall" />
            </div>
            <div className="landing-app__field">
              <span>Available from (UTC)</span>
              <div className="landing-app__input" />
            </div>
            <div className="landing-app__field">
              <span>Available until (UTC)</span>
              <div className="landing-app__input" />
            </div>
            <div className="landing-app__field">
              <span>Duration (minutes)</span>
              <div className="landing-app__input landing-app__duration">60</div>
            </div>
            <div className="landing-app__field landing-app__switches">
              <span>Randomize questions</span>
              <span className="landing-app__switch" />
              <span>Randomize answer choices</span>
              <span className="landing-app__switch" />
            </div>
          </div>
          <div className="landing-app__actions">
            <span className="landing-app__draft-note">
              Availability is checked against server time.
            </span>
            <span className="landing-app__button">Create draft</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowScreen({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="workflow-screen" role="img" aria-label={label}>
      <div className="workflow-screen__bar">
        <span className="workflow-screen__window-mark" />
        <span>Evalify</span>
        <span className="workflow-screen__bar-title">{label}</span>
      </div>
      <div className="workflow-screen__body">{children}</div>
    </div>
  );
}

function SetupVisual() {
  return (
    <figure className="mo-pc__visual mo-pc__visual--lit">
      <WorkflowScreen label="Examination setup">
        <div className="workflow-screen__title">Set the examination</div>
        <div className="workflow-screen__form">
          <div className="workflow-screen__field">
            <span>Candidate instructions</span>
            <i />
          </div>
          <div className="workflow-screen__field">
            <span>Availability (UTC)</span>
            <i />
          </div>
          <div className="workflow-screen__field">
            <span>Duration</span>
            <i />
          </div>
        </div>
      </WorkflowScreen>
    </figure>
  );
}

function MonitoringVisual() {
  return (
    <figure className="mo-pc__visual mo-pc__visual--lit">
      <WorkflowScreen label="Attempt monitoring">
        <div className="workflow-screen__title">Attempt monitoring</div>
        <div className="workflow-screen__monitor">
          <div>
            <span className="workflow-screen__indicator" />
            <span>Persisted attempt progress</span>
          </div>
          <div>
            <span className="workflow-screen__indicator workflow-screen__indicator--blue" />
            <span>Browser-level events</span>
          </div>
        </div>
        <p className="workflow-screen__note">
          Review recorded activity without inferring connection state.
        </p>
      </WorkflowScreen>
    </figure>
  );
}

function ReportsVisual() {
  return (
    <figure className="mo-pc__visual mo-pc__visual--lit">
      <WorkflowScreen label="Evaluation and result reports">
        <div className="workflow-screen__title">Evaluation and reports</div>
        <div className="workflow-screen__actions">
          <span>Grade submission</span>
          <span>Finalize result</span>
          <span className="workflow-screen__action-primary">Issue report</span>
        </div>
        <div className="workflow-screen__verify">
          <span className="workflow-screen__verify-mark">✓</span>
          <span>Public report verification</span>
        </div>
      </WorkflowScreen>
    </figure>
  );
}

export function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <>
      <link rel="stylesheet" href="/assets/system.css" precedence="default" />
      <link rel="stylesheet" href="/assets/ui/cards.css" precedence="default" />
      <link rel="stylesheet" href="/assets/motion/motion.css" precedence="default" />
      <link
        rel="stylesheet"
        href="/assets/backgrounds/backgrounds.css"
        precedence="default"
      />
      <link rel="stylesheet" href="/assets/layout/layout.css" precedence="default" />
      <link rel="stylesheet" href="/assets/icons/icon.css" precedence="default" />
      {/* software · cool-grey-cobalt · Geist · centred · painterly-landscape · pinned-chapters · nav-centre · footer-statement · close-type · space · tonal · wordmark */}
      <div className="landing-page">
        <header className="nav nav--centre">
          <div className="wrap nav__bar">
            <a className="skip-link" href="#top">
              Skip to content
            </a>
            <Link
              aria-label="Evalify home"
              className="nav__logo"
              href="#top"
            >
              <BrandImage priority />
            </Link>
            <nav aria-label="Main" className="nav__links" id="primary-navigation">
              {navigation.map((item) => (
                <div className="nav__item" key={item.href}>
                  <Link className="nav__link" href={item.href}>
                    {item.label}
                  </Link>
                </div>
              ))}
            </nav>
            <div className="nav__actions">
              <Link className="btn btn--primary" href="/sign-in">
                Sign in
              </Link>
            </div>
            <button
              aria-controls="primary-navigation"
              aria-expanded="false"
              aria-label="Menu"
              className="nav__toggle"
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  d="M2 5h14M2 13h14"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>
          </div>
        </header>

        <main id="top">
          <section
            aria-labelledby="hero-heading"
            className="hero hero--centred"
            data-enter
          >
            <div className="wrap">
              <div className="hero-text">
                <div className="hero__c">
                  <p className="hero__kicker">
                    One server-timed attempt per candidate
                  </p>
                  <h1 id="hero-heading">
                    Online examination platform for examiners
                  </h1>
                  <p className="hero__lead">
                    Create examinations, follow server-timed attempts and issue
                    reports the public can verify without exposing candidate
                    marks.
                  </p>
                  <div className="btn-row">
                    <Link className="btn btn--primary" href="/sign-in">
                      Sign in
                    </Link>
                  </div>
                </div>
                <div
                  aria-label="Question bank with single choice, multiple select and written response formats"
                  className="hero__window"
                  data-fx="painterly-landscape"
                  data-fx-seed="1795786652433-6oxpbd"
                  role="img"
                >
                  <div aria-hidden="true" className="ly-piece hero-preview">
                    <div className="hero-preview__bar">
                      <span className="hero-preview__dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>Evalify / Question bank</span>
                      <span className="hero-preview__role">Examiner</span>
                    </div>
                    <div className="hero-preview__body">
                      <aside className="hero-preview__sidebar">
                        <span className="hero-preview__side-label">
                          Workspace
                        </span>
                        <span>Examinations</span>
                        <span className="is-current">Question bank</span>
                        <span>Evaluation queue</span>
                        <span>Reports</span>
                      </aside>
                      <div className="hero-preview__content">
                        <div className="hero-preview__heading">
                          <div>
                            <span className="hero-preview__eyebrow">
                              Question bank
                            </span>
                            <span className="hero-preview__title">
                              Choose a format
                            </span>
                          </div>
                          <span className="hero-preview__button">
                            Add question
                          </span>
                        </div>
                        <QuestionFormats />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="platform-heading"
            className="section"
            id="platform"
          >
            <div className="wrap">
              <div className="grid landing-app-head">
                <div className="span-5">
                  <h2 id="platform-heading">Examination setup</h2>
                  <p>
                    Set candidate instructions, UTC availability and duration
                    before enrolling candidates and publishing.
                  </p>
                </div>
                <div className="span-6 start-7 landing-app-head__aside">
                  <p id="questions">
                    Assign reusable questions as snapshots to each examination.
                  </p>
                  <Link className="link" href="#workflow">
                    See the workflow
                  </Link>
                </div>
              </div>
              <ExaminerWorkspace />
            </div>
          </section>

          <section
            aria-labelledby="workflow-heading"
            className="section"
            data-moment="pinned-chapters"
            id="workflow"
          >
            <div className="wrap mo-pc__grid">
              <div className="mo-pc__text">
                <h2 id="workflow-heading">From setup to verified results</h2>
                <ol className="mo-pc__steps">
                  <li className="mo-pc__step">
                    <h3>Set the examination</h3>
                    <p>
                      Choose instructions, schedule and duration. Add questions
                      and candidates before publishing.
                    </p>
                    <SetupVisual />
                  </li>
                  <li className="mo-pc__step">
                    <h3>Monitor each attempt</h3>
                    <p>
                      Review persisted progress and browser events while
                      candidates work.
                    </p>
                    <MonitoringVisual />
                  </li>
                  <li className="mo-pc__step">
                    <h3>Grade and issue reports</h3>
                    <p>
                      Finalize submitted attempts, publish results and issue
                      reports candidates can verify.
                    </p>
                    <ReportsVisual />
                  </li>
                </ol>
              </div>
              <div className="mo-pc__visuals frame" />
            </div>
          </section>

          <section
            aria-labelledby="reports-heading"
            className="section"
            id="reports"
          >
            <div className="wrap grid landing-reports">
              <div className="span-5">
                <h2 id="reports-heading">Verify an issued report</h2>
                <p>
                  Check whether a report is valid, revoked or nonexistent.
                  Public verification never exposes candidate details or marks.
                </p>
              </div>
              <div className="span-6 start-7 landing-verify">
                <ReportVerificationForm />
              </div>
            </div>
          </section>
        </main>

        <footer
          aria-labelledby="close-heading"
          className="footer closing footer--statement"
        >
          <div className="wrap">
            <div className="closing__cta close--type">
              <div className="section-head">
                <h2 id="close-heading">
                  Continue to the examination workspace
                </h2>
              </div>
              <Link
                className="btn btn--primary btn--xl btn--wide"
                href="/sign-in"
              >
                Sign in
                <Arrow />
              </Link>
            </div>
            <div className="closing__links">
              <div className="grid landing-footer-grid">
                <div className="span-5">
                  <Link
                    aria-label="Evalify home"
                    className="footer__mark"
                    href="#top"
                  >
                    <BrandImage />
                  </Link>
                </div>
                <div className="span-3 start-7 footer__col">
                  <h3 className="t-card">On this page</h3>
                  <ul>
                    {navigation.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href}>{item.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="span-3 footer__col">
                  <h3 className="t-card">Reports</h3>
                  <ul>
                    <li>
                      <Link href="/verify">Verify a report</Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="footer__legal">
                <span>© {year} Evalify</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
      <script defer type="module" src="/assets/system.js" />
      <script defer type="module" src="/assets/motion/motion.js" />
      <script defer type="module" src="/assets/layout/layout.js" />
    </>
  );
}
