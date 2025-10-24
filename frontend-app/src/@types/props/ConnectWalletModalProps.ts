export interface ConnectWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (method: 'zklogin' | 'wallet') => void;
}