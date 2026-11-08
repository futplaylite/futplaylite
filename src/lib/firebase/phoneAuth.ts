import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  UserCredential,
} from 'firebase/auth';
import { firebaseAuth } from './config';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

/**
 * Converte o telefone digitado (ex: (77) 98888-7777 ou 77988887777)
 * para o formato internacional E.164 com código do Brasil (+5577988887777)
 */
export function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

/**
 * Inicializa ou reaproveita o RecaptchaVerifier invisível do Firebase
 */
export function getOrCreateRecaptcha(containerId = 'recaptcha-container'): RecaptchaVerifier {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA só pode ser inicializado no navegador.');
  }

  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  const verifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA resolvido silenciosamente
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expirou.');
    },
  });

  window.recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Envia o SMS com código de 6 dígitos via Firebase Authentication
 */
export async function sendFirebaseSmsCode(
  rawPhone: string,
  containerId = 'recaptcha-container'
): Promise<ConfirmationResult> {
  const e164 = formatToE164(rawPhone);
  const verifier = getOrCreateRecaptcha(containerId);
  const confirmationResult = await signInWithPhoneNumber(firebaseAuth, e164, verifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
}

/**
 * Valida o código de 6 dígitos digitado pelo usuário
 */
export async function confirmFirebaseSmsCode(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<UserCredential> {
  return await confirmationResult.confirm(code.trim());
}
