const baseClassName = "cake-next-btn";

type CakeNextButtonProps = {
  disabled?: boolean;
  onClick: () => void;
  shake?: boolean;
  ariaLabel?: string;
};

export const CakeNextButton = ({
  disabled,
  onClick,
  shake,
  ariaLabel
}: CakeNextButtonProps) => {
  const className = [baseClassName, shake ? `${baseClassName}--wobble` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? "Далее"}
    >
      <img
        src="/icons/cake-crab.svg"
        alt=""
        aria-hidden="true"
        className={`${baseClassName}__icon`}
      />
    </button>
  );
};

export type { CakeNextButtonProps };
