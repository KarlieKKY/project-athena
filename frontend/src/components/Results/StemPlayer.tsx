interface StemPlayerProps {
  src: string;
}

const StemPlayer = ({ src }: StemPlayerProps) => {
  return (
    <audio controls className="w-full">
      <source src={src} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};

export default StemPlayer;
