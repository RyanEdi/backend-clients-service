/**
 * Funções de sanitização e validação
 */

// Remove todos os caracteres não numéricos
export const onlyDigits = (value: string | undefined | null): string => {
  return (value || '').replace(/\D/g, '');
};

// Remove espaços em branco do início e fim
export const sanitizeText = (value: string | undefined | null): string => {
  return (value || '').trim();
};

// Regex para validação de senha
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Validação de senha
// Requisitos: mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número
export const validatePassword = (senha: string): { valid: boolean; message: string } => {
  if (!senha || senha.length < 8) {
    return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres.' };
  }
  if (!/[a-z]/.test(senha)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula.' };
  }
  if (!/[A-Z]/.test(senha)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula.' };
  }
  if (!/\d/.test(senha)) {
    return { valid: false, message: 'A senha deve conter pelo menos um número.' };
  }
  return { valid: true, message: '' };
};
