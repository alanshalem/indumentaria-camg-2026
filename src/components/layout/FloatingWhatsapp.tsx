import { CLUB } from '@shared/domain/club';
import { whatsappLink } from '@shared/domain/phone';
import { WhatsappIcon } from '@/ui/icons';
import styles from './FloatingWhatsapp.module.css';

export function FloatingWhatsapp() {
  const phone = CLUB.contactPhone || '+54 9 11 3146-0477';
  const url = whatsappLink(phone);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.floatingButton}
      aria-label={`Contactar a Indumentaria CAMG por WhatsApp (${phone})`}
      title={`Indumentaria CAMG · WhatsApp ${phone}`}
    >
      <span className={styles.iconWrap}>
        <WhatsappIcon size={24} />
      </span>
      <span className={styles.label}>
        <span className={styles.title}>Indumentaria CAMG</span>
        <span className={styles.subtitle}>{phone}</span>
      </span>
    </a>
  );
}

