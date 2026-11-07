import { normalizeCheckoutPhone, type CheckoutFieldErrors } from "@/lib/checkout-contact";

export function CheckoutFieldError({ name, message }: { name: string; message?: string }) {
  return message ? <p id={`checkout-${name}-error`} className="checkout-field-error" role="alert">{message}</p> : null;
}

export function CheckoutContactFields({ phone, city, regions, errors, onPhoneChange, onCityChange }: {
  phone: string; city: string; regions: string[]; errors: CheckoutFieldErrors;
  onPhoneChange: (value: string) => void; onCityChange: (value: string) => void;
}) {
  return <>
    <div className="field"><label htmlFor="checkout-name">Ad və soyad</label>
      <input id="checkout-name" name="name" autoComplete="name" minLength={2} maxLength={100} required placeholder="Adınız və soyadınız"
        aria-invalid={!!errors.name} aria-describedby={errors.name ? "checkout-name-error" : undefined} />
      <CheckoutFieldError name="name" message={errors.name} />
    </div>
    <div className="field"><label htmlFor="checkout-phone">Telefon nömrəsi</label>
      <div className="checkout-phone-control" data-invalid={!!errors.phone}>
        <span aria-hidden="true">+994</span>
        <input id="checkout-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={13}
          placeholder="501234567" value={phone} onChange={event => onPhoneChange(event.target.value)}
          onPaste={event => {
            const value = event.clipboardData.getData("text");
            const normalized = normalizeCheckoutPhone(value);
            if (normalized) { event.preventDefault(); onPhoneChange(normalized.slice(4)); }
            else if (!/^[0-9]+$/.test(value) || value.length > 9) { event.preventDefault(); onPhoneChange(value); }
          }}
          aria-invalid={!!errors.phone} aria-describedby={`checkout-phone-hint${errors.phone ? " checkout-phone-error" : ""}`} />
      </div>
      <small id="checkout-phone-hint">Ölkə kodu +994. 9 rəqəm yazın: 501234567.</small>
      <CheckoutFieldError name="phone" message={errors.phone} />
    </div>
    <div className="field span-2"><label htmlFor="checkout-city">Şəhər və ya bölgə</label>
      <select id="checkout-city" name="city" value={city} onChange={event => onCityChange(event.target.value)} required
        aria-invalid={!!errors.city} aria-describedby={errors.city ? "checkout-city-error" : undefined}>
        <option value="">Bölgənizi seçin</option>{regions.map(region => <option key={region}>{region}</option>)}
      </select><CheckoutFieldError name="city" message={errors.city} />
    </div>
    <div className="field span-2"><label htmlFor="checkout-address">Çatdırılma ünvanı</label>
      <textarea id="checkout-address" name="address" autoComplete="street-address" required minLength={5} maxLength={500} rows={3}
        placeholder="Küçə, bina, mənzil və digər məlumatlar" aria-invalid={!!errors.address} aria-describedby={errors.address ? "checkout-address-error" : undefined} />
      <CheckoutFieldError name="address" message={errors.address} />
    </div>
  </>;
}
