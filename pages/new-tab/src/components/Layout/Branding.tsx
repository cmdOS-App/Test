import React from 'react';
import logoUrl from '../../assets/tasklabs_logo.png';
import { useSelector } from 'react-redux';
import { selectDarkMode, selectSelectedTeam } from '../../../../Redux/AllData/uiStateSlice';
import { getAvatarColor, getSingleInitial } from '../../utils/avatarColors';

interface BrandingProps {
  className?: string;
  onClick?: () => void;
  showAvatar?: boolean;
  textColor?: string;
}

const Branding: React.FC<BrandingProps> = ({ className = '', onClick, showAvatar = false, textColor }) => {
  const isDarkMode = useSelector(selectDarkMode);
  const selectedTeam = useSelector(selectSelectedTeam);



  return (
    <div className={`flex items-center gap-2  z-50 ${className}`}>

      {logoUrl ? (
        <img
          src={logoUrl}
          className="h-9 w-7 rounded cursor-pointer select-none"
          onClick={onClick}
          alt="cmdOS"
        />
      ) : null}
      <span
        className={`text-lg ${textColor || (!isDarkMode ? 'text-[#073642]' : 'text-white')} font-comfortaa cursor-pointer select-none`}
        onClick={onClick}>
        cmdOS
      </span>
    </div>
  );
};

export default Branding;
