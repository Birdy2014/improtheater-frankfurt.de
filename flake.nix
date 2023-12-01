{
  description = "improtheater-frankfurt.de";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }: {
    packages = let
      improtheater-frankfurt-package = system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in pkgs.buildNpmPackage {
          pname = "improtheater-frankfurt.de";
          version = "1.0.0";

          src = ./.;
          npmDepsHash = "sha256-NOo9MGQ1z8I+0GCj/zc5OLPZzSGV9hfJ+aKKVtBSZMM=";

          nativeBuildInputs = with pkgs; [
            # for bcrypt
            nodePackages.node-pre-gyp

            # for sharp
            nodePackages.node-gyp
            pkg-config
          ];

          buildInputs = with pkgs;
            [
              # for sharp
              vips
            ];

          nodejs = pkgs.nodejs_18;

          dontNpmBuild = true;

          npmInstallFlags = [ "--build-from-source" ];
          makeCacheWritable = true;
        };
    in {
      aarch64-linux.improtheater-frankfurt =
        improtheater-frankfurt-package "aarch64-linux";
      aarch64-linux.default =
        self.packages.aarch64-linux.improtheater-frankfurt;
      x86_64-linux.improtheater-frankfurt =
        improtheater-frankfurt-package "x86_64-linux";
      x86_64-linux.default = self.packages.x86_64-linux.improtheater-frankfurt;
    };

    nixosModules.default = { config, pkgs, lib, ... }:
      let
        cfg = config.services.improtheater-frankfurt;

        config_file = pkgs.writeTextFile {
          name = "improtheater-frankfurt-config";
          text = builtins.toJSON cfg.settings;
        };
      in {
        options.services.improtheater-frankfurt = {
          enable = lib.mkEnableOption {
            description = lib.mdDoc "Improtheater Frankfurt website";
          };

          package = lib.mkOption {
            type = lib.types.package;
            default = self.packages.${pkgs.system}.improtheater-frankfurt;
          };

          settings = lib.mkOption { type = lib.types.attrs; };
        };

        config = lib.mkIf cfg.enable {
          systemd.services.improtheater-frankfurt = {
            description = "Improtheater Frankfurt website";
            after = [ "network.target" ];
            wantedBy = [ "multi-user.target" ];
            environment = {
              NODE_ENV = "production";
              ITF_CONFIG_FILE = config_file;
            };
            script = "${cfg.package}/bin/improtheater-frankfurt";
          };

          services.nginx = {
            enable = true;
            virtualHosts = {
              "${cfg.settings.hostname}" = {
                locations."/".proxyPass = "http://${cfg.settings.hostname}:${
                    builtins.toString cfg.settings.port
                  }/";
              };
            };
          };
        };
      };
  };
}
