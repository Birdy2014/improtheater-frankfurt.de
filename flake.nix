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
          npmDepsHash = "sha256-rvu6+NRj5VtvKCejAVii8gU7ADC5hmnNKZ2Gsx1NzyA=";

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
          text = builtins.toJSON cfg;
        };
      in {
        options.services.improtheater-frankfurt = with lib; {
          enable = mkEnableOption {
            description = mdDoc "Improtheater Frankfurt website";
          };

          package = mkOption {
            type = types.package;
            default = self.packages.${pkgs.system}.improtheater-frankfurt;
          };

          hostname = mkOption { type = types.str; };
          port = mkOption { type = types.int; };
          tls = mkOption { type = types.bool; };
          logpath = mkOption { type = types.str; };
          dbpath = mkOption { type = types.str; };

          email = mkOption {
            type = types.attrsOf (types.submodule {
              options = {
                host = mkOption { type = types.str; };
                port = mkOption { type = types.int; };
                secure = mkOption { type = types.bool; };
                user = mkOption { type = types.str; };
                password = mkOption {
                  type = types.nullOr types.str;
                  default = null;
                };
                password_file = mkOption {
                  type = types.nullOr types.str;
                  default = null;
                };
                from = mkOption { type = types.str; };
              };
            });
          };
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
              "${cfg.hostname}" = {
                locations."/".proxyPass =
                  "http://${cfg.hostname}:${builtins.toString cfg.port}/";
              };
            };
          };
        };
      };
  };
}
