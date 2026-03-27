'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './page.module.css';

export default function MotionLabTwoPage() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from('.lab2-reveal', {
        y: 26,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
      });

      gsap.fromTo(
        '.lab2-fold',
        { rotateX: 75, opacity: 0, y: 30 },
        {
          rotateX: 0,
          opacity: 1,
          y: 0,
          duration: 0.86,
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: '.lab2-fold-wrap',
            start: 'top 72%',
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    e.currentTarget.style.setProperty('--mx', String(Math.max(0, Math.min(1, mx))));
    e.currentTarget.style.setProperty('--my', String(Math.max(0, Math.min(1, my))));
  };

  return (
    <main className={styles.root}>
      <header className={styles.topBar}>
        <h1 className={styles.title}>Motion Lab 2 · Focus Shift Hologlass</h1>
        <p className={styles.meta}>Route: /motion-lab-2</p>
      </header>

      <section
        className={styles.hero}
        onMouseMove={onMove}
        onMouseLeave={(e) => {
          e.currentTarget.style.setProperty('--mx', '0.5');
          e.currentTarget.style.setProperty('--my', '0.5');
        }}
      >
        <div className={styles.atmosphere} />
        <div className={styles.grid} />

        <div className={styles.cards}>
          <article className={`${styles.card} lab2-reveal`}>
            <h3>Option 2</h3>
            <p>Focus point mouse ile geziyor, sahnenin agirlik merkezi canli sekilde kayiyor.</p>
          </article>
          <article className={`${styles.card} lab2-reveal`}>
            <h3>Perceptual Depth</h3>
            <p>Katmanlar tek tek degil, butun atmosfer olarak hareket ediyor. Daha premium bir his verir.</p>
          </article>
          <article className={`${styles.card} lab2-reveal`}>
            <h3>Interactive Calm</h3>
            <p>Gosterisli ama yorucu degil. Kurumsal dashboard acilisi icin dengeli futuristik yaklasim.</p>
          </article>
        </div>
      </section>

      <section className={`${styles.foldSection} lab2-fold-wrap`}>
        <div className={styles.foldStack}>
          <div className={`${styles.foldCard} ${styles.lab2Fold} lab2-fold`}>
            <span className={styles.foldTitle}>Signal Layer</span>
            <span className={styles.foldMeta}>Scroll ile katman acilisi</span>
          </div>
          <div className={`${styles.foldCard} ${styles.lab2Fold} lab2-fold`}>
            <span className={styles.foldTitle}>Focus Layer</span>
            <span className={styles.foldMeta}>Odak kaymasi, sakin gecis</span>
          </div>
          <div className={`${styles.foldCard} ${styles.lab2Fold} lab2-fold`}>
            <span className={styles.foldTitle}>Action Layer</span>
            <span className={styles.foldMeta}>Dashboard girisine temiz baglanti</span>
          </div>
        </div>
      </section>
    </main>
  );
}
