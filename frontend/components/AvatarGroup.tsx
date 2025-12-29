import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const getInitials = (username: string): string => {
    if (!username) return "?";
    const firstChar = username.charAt(0).toUpperCase();
    return firstChar;
};

export const AvatarGroup = ({ managers }: { managers: { id: number; username: string; avatar?: string | null }[] }) => {
    if (!managers || managers.length === 0) {
        return <span className="text-gray-500">—</span>;
    }

    const maxVisible = 3;
    const visibleManagers = managers.slice(0, maxVisible);
    const remainingCount = managers.length - maxVisible;
    const allUsernames = managers.map((m) => m.username).join(", ");

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                    {visibleManagers.map((manager) => (
                        <Avatar
                            key={manager.id}
                            className="h-8 w-8 border-2 border-white -ml-1 first:ml-0"
                        >
                            {manager.avatar && (
                                <AvatarImage src={manager.avatar} alt={manager.username} />
                            )}
                            <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                                {getInitials(manager.username)}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    {remainingCount > 0 && (
                        <Avatar className="h-8 w-8 border-2 border-white bg-gray-400 -ml-1">
                            <AvatarFallback className="text-white text-xs font-semibold bg-gray-400">
                                +{remainingCount}
                            </AvatarFallback>
                        </Avatar>
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-sm">
                    <p className="font-semibold mb-1">Tài khoản quản lý:</p>
                    <p>{allUsernames}</p>
                </div>
            </TooltipContent>
        </Tooltip>
    );
};