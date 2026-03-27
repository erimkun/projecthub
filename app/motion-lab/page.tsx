'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './page.module.css';

export default function MotionLabPage() {
  const optionTwoRef = useRef<HTMLElement>(null);
  const tunnelLayerStyles: Array<CSSProperties & Record<'--z', string>> = [
    { '--z': '-260px' },
    { '--z': '-160px' },
    { '--z': '-60px' },
  ];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from('.lab-reveal', {
        y: 24,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
      });

      gsap.utils.toArray<HTMLElement>('.tunnel-layer').forEach((layer, idx) => {
        gsap.to(layer, {
          yPercent: -20 - idx * 14,
          rotateX: 22 + idx * 1.5,
          scrollTrigger: {
            trigger: '#option-1',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });

      gsap.fromTo(
        '.fold-card',
        { rotateX: 72, opacity: 0, y: 26 },
        {
          rotateX: 0,
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: '#option-3',
            start: 'top 70%',
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  const handleFocusMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    e.currentTarget.style.setProperty('--mx', String(Math.max(0, Math.min(1, mx))));
    e.currentTarget.style.setProperty('--my', String(Math.max(0, Math.min(1, my))));
  };

  return (
    <main className={styles.labRoot}>
      <header className={`${styles.labHeader} lab-reveal`}>
        <div>
          <h1 className={styles.headerTitle}>Motion Lab: Option 1 / 2 / 3</h1>
          <p className={styles.headerMeta}>Scroll ederek hepsini canli gor. Sectigini ana sayfaya aynen tasiyalim.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.jumpBtn} href="#option-1">Option 1</a>
          <a className={styles.jumpBtn} href="#option-2">Option 2</a>
          <a className={styles.jumpBtn} href="#option-3">Option 3</a>
        </div>
      </header>

      <section className={styles.introBlock}>
        <p className={`${styles.introKicker} lab-reveal`}>Futuristic Prototype Deck</p>
        <h2 className={`${styles.introTitle} lab-reveal`}>Uc farkli hareket dili, tek karar: hangisi ana hero olsun?</h2>
        <p className={`${styles.introCopy} lab-reveal`}>
          Bu sayfa sadece secim icin. Animasyon, derinlik ve scroll hissi acisindan uc farkli yon sunuyor.
          Hangi option daha iyi hissettirirse onu ana acilis ekranina full quality uygulayacagim.
        </p>
      </section>

      <section id="option-1" className={`${styles.optionSection} ${styles.optionOne}`}>
        <div className={styles.optionHead}>
          <div>
            <p className={styles.optionLabel}>Option 1</p>
            <h3 className={styles.optionName}>Neural Tunnel Drift</h3>
          </div>
          <p className={styles.optionHint}>Parallax + derinlik + sonsuz tünel hissi</p>
        </div>
        <div className={`${styles.optionStage} ${styles.optionOneStage}`}>
          <div className={styles.tunnelWrap}>
            <div className={`${styles.tunnelLayer} tunnel-layer`} style={tunnelLayerStyles[0]}>
              <div className={styles.tunnelGrid} />
            </div>
            <div className={`${styles.tunnelLayer} tunnel-layer`} style={tunnelLayerStyles[1]}>
              <div className={styles.tunnelGrid} />
            </div>
            <div className={`${styles.tunnelLayer} tunnel-layer`} style={tunnelLayerStyles[2]}>
              <div className={styles.tunnelGrid} />
            </div>
            <div className={styles.tunnelCore} />
          </div>
        </div>
      </section>

      <section id="option-2" ref={optionTwoRef} className={styles.optionSection}>
        <div className={styles.optionHead}>
          <div>
            <p className={styles.optionLabel}>Option 2</p>
            <h3 className={styles.optionName}>Focus Shift Hologlass</h3>
          </div>
          <p className={styles.optionHint}>Fare ile odak kaymasi + sisli holografik derinlik</p>
        </div>
        <div
          className={`${styles.optionStage} ${styles.optionTwoStage}`}
          onMouseMove={handleFocusMove}
          onMouseLeave={(e) => {
            e.currentTarget.style.setProperty('--mx', '0.5');
            e.currentTarget.style.setProperty('--my', '0.5');
          }}
        >
          <div className={styles.focusCloud} />
          <div className={styles.focusCards}>
            <article className={styles.focusCard}>
              <h4>Realtime Coordination</h4>
              <p>Dashboard bloklari odaga gore yakinlasir, arka plan bilinci azaltir, ana aksiyon one cikar.</p>
            </article>
            <article className={styles.focusCard}>
              <h4>Depth-by-Intent</h4>
              <p>Kullanici nereye bakarsa orasi netlesir; diger katmanlar yumuşakca arkaplana itilir.</p>
            </article>
            <article className={styles.focusCard}>
              <h4>Interactive Atmosphere</h4>
              <p>Statik hero yerine reaksiyon veren bir sahne: modern, oyun hissi veren ama profesyonel.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="option-3" className={styles.optionSection}>
        <div className={styles.optionHead}>
          <div>
            <p className={styles.optionLabel}>Option 3</p>
            <h3 className={styles.optionName}>Chrono Fold Sequence</h3>
          </div>
          <p className={styles.optionHint}>Asagi indikce katman katman acilan zaman paneli</p>
        </div>
        <div className={`${styles.optionStage} ${styles.optionThreeStage}`}>
          <div className={styles.foldStack}>
            <div className={`${styles.foldCard} fold-card`}>
              <span className={styles.foldTitle}>Week Signal</span>
              <span className={styles.foldMeta}>Hareket scroll hizina uyumlu</span>
            </div>
            <div className={`${styles.foldCard} fold-card`}>
              <span className={styles.foldTitle}>Team Pulse</span>
              <span className={styles.foldMeta}>Katmanlar focusu merkeze tasir</span>
            </div>
            <div className={`${styles.foldCard} fold-card`}>
              <span className={styles.foldTitle}>Action Surface</span>
              <span className={styles.foldMeta}>Dashboard girisinde sert ama temiz final</span>
            </div>
            <div className={`${styles.foldCard} fold-card`}>
              <span className={styles.foldTitle}>Control Core</span>
              <span className={styles.foldMeta}>Modern + futuristik + ritmik</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
