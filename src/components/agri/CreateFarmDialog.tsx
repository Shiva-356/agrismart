import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Loader2, Sprout } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadUser, setActiveFarmId } from "@/lib/agri";
import { farmsApi, ApiError, type CreateFarmRequest } from "@/services/api";
import { adaptFarmResponse, type Farm } from "@/services";

export interface CreateFarmDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (farm: Farm) => void;
}

export function CreateFarmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: CreateFarmDialogProps) {
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setUncontrolledOpen;

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [landAreaAcres, setLandAreaAcres] = useState("");
  const [currentCrop, setCurrentCrop] = useState("");
  const [irrigation, setIrrigation] = useState("Drip");
  const [loading, setLoading] = useState(false);

  const user = loadUser();
  const hasBackendUser = Boolean(user?.id);

  const resetForm = () => {
    setName("");
    setLocation("");
    setDistrict("");
    setLandAreaAcres("");
    setCurrentCrop("");
    setIrrigation("Drip");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error(
        "A registered backend account is required to create a farm. Please log in or register first.",
      );
      return;
    }

    const areaNumber = parseFloat(landAreaAcres);
    if (isNaN(areaNumber) || areaNumber <= 0) {
      toast.error("Land area must be a positive number of acres.");
      return;
    }

    const payload: CreateFarmRequest = {
      userId: user.id,
      name: name.trim(),
      location: location.trim(),
      district: district.trim(),
      landAreaAcres: areaNumber,
      currentCrop: currentCrop.trim() ? currentCrop.trim() : null,
      irrigation: irrigation.trim() || "Drip",
    };

    setLoading(true);
    try {
      const response = await farmsApi.create(payload);
      const adapted = adaptFarmResponse(response, user.fullName);
      setActiveFarmId(adapted.id);
      await queryClient.invalidateQueries({ queryKey: ["farm"] });
      toast.success(`Farm "${adapted.name}" created successfully!`);
      resetForm();
      setIsOpen(false);
      onSuccess?.(adapted);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isValidationError) {
        const firstMsg = err.fieldErrors ? Object.values(err.fieldErrors)[0] : null;
        toast.error(firstMsg || err.message || "Failed to create farm. Check form fields.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Failed to create farm.");
      } else {
        toast.error("Failed to create farm. Please verify backend connectivity.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sprout className="size-5" />
            </div>
            <div>
              <DialogTitle>Add New Farm</DialogTitle>
              <DialogDescription>
                Register your field details for AI soil and crop recommendations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!hasBackendUser ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Backend User Required</p>
                <p className="mt-0.5">
                  You are currently in demo mode. Register or log in to link real farms to your
                  account.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="farm-name">Farm Name *</Label>
            <Input
              id="farm-name"
              required
              placeholder="e.g. Green Valley Farm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-location">Village / Location *</Label>
              <Input
                id="farm-location"
                required
                placeholder="e.g. Rampur"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-district">District *</Label>
              <Input
                id="farm-district"
                required
                placeholder="e.g. Varanasi"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-area">Land Area (Acres) *</Label>
              <Input
                id="farm-area"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="e.g. 5.5"
                value={landAreaAcres}
                onChange={(e) => setLandAreaAcres(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-irrigation">Irrigation Method *</Label>
              <Input
                id="farm-irrigation"
                required
                placeholder="e.g. Drip, Sprinkler, Canal"
                value={irrigation}
                onChange={(e) => setIrrigation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="farm-crop">Current Crop (Optional)</Label>
            <Input
              id="farm-crop"
              placeholder="e.g. Wheat, Rice, Mustard"
              value={currentCrop}
              onChange={(e) => setCurrentCrop(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !hasBackendUser}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save Farm"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
