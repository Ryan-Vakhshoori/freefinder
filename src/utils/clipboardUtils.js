import feather from 'feather-icons';

export function copyWithFeedback(button, text, iconSize = 16) {
  if (button._isCheck) return;
  navigator.clipboard.writeText(text);
  button.innerHTML = feather.icons.check.toSvg({ width: iconSize, height: iconSize });
  button.classList.add("checking");
  button._isCheck = true;
  if (button._timeoutId) clearTimeout(button._timeoutId);
  button._timeoutId = setTimeout(() => {
    button.innerHTML = feather.icons.copy.toSvg({ width: iconSize, height: iconSize });
    button.classList.remove("checking");
    button._isCheck = false;
    button._timeoutId = null;
  }, 1200);
}