export default function Step({ number, title, description }: {
    number: string;
    title: string;
    description: string;
}) {
    return (
        <div className="flex gap-6 items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {number}
            </div>
            <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600">{description}</p>
            </div>
        </div>
    );
}